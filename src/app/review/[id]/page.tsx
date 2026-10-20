"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Navbar from "@/components/layout/navbar";
import { getLemma } from "@/lib/lemma";

interface ParsedData {
  frequencyMap: Record<string, number>;
  wordContexts: Record<string, string[]>;
  cleanedText: string;
}

interface ReviewProgress {
  currentIndex: number;
  completed: boolean;
}

interface TranscriptData {
  id: string;
  title: string;
  parsedData: ParsedData;
  reviewProgress?: ReviewProgress | null;
}

interface DefinitionData {
  word: string;
  phonetic: string | null;
  audioUrl: string | null;
  partOfSpeech: string;
  definition: string;
  example: string | null;
  synonyms?: string[];
  allMeanings?: Array<{
    partOfSpeech?: string;
    definition?: string;
    example?: string | null;
  }>;
  found: boolean;
}

interface ReviewWord {
  word: string;
  lemma: string;
  frequency: number;
  context: string;
}

export default function ReviewPage() {
  const params = useParams();
  const router = useRouter();
  const transcriptId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [transcript, setTranscript] = useState<TranscriptData | null>(null);
  const [reviewQueue, setReviewQueue] = useState<ReviewWord[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(1); // 1 = forward, -1 = back
  const [showLearn, setShowLearn] = useState(false);
  const [definition, setDefinition] = useState<DefinitionData | null>(null);
  const [defLoading, setDefLoading] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [savingWord, setSavingWord] = useState(false);
  const [resumeNotice, setResumeNotice] = useState<string | null>(null);

  const saveProgressTimeout = useRef<NodeJS.Timeout | null>(null);

  // Persist progress to server and localStorage
  const persistProgress = useCallback(
    (index: number, isFinished: boolean) => {
      // 1. Instant local storage
      try {
        localStorage.setItem(
          `wordbank_progress_${transcriptId}`,
          JSON.stringify({ currentIndex: index, completed: isFinished, timestamp: Date.now() })
        );
      } catch {
        // ignore storage errors
      }

      // 2. Debounced server save
      if (saveProgressTimeout.current) {
        clearTimeout(saveProgressTimeout.current);
      }
      saveProgressTimeout.current = setTimeout(async () => {
        try {
          await fetch(`/api/transcripts/${transcriptId}/progress`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              currentIndex: index,
              completed: isFinished,
            }),
          });
        } catch {
          // Continue even if network fails
        }
      }, 500);
    },
    [transcriptId]
  );

  // Load transcript, check known words (with lemmas), and resume saved position
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/transcripts/${transcriptId}`);
        if (res.status === 401) {
          router.replace(`/login?redirect=/review/${transcriptId}`);
          return;
        }
        if (!res.ok) throw new Error("Not found");
        const data: TranscriptData = await res.json();
        setTranscript(data);

        const parsed = data.parsedData;
        const allWords = Object.keys(parsed.frequencyMap);

        // Check which words (or their lemmas) are already known in the database
        const checkRes = await fetch("/api/words/check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ words: allWords }),
        });
        const checkData = await checkRes.json();
        const knownSet = new Set<string>(checkData.knownTexts || []);

        // Build review queue:
        // 1. Filter out words already known (or whose lemma is known)
        // 2. Group within this transcript by lemma so variants (e.g. like, likes, liked, liking)
        //    are consolidated into the most frequent form!
        const lemmaMap = new Map<string, ReviewWord>();

        for (const word of allWords) {
          if (knownSet.has(word)) continue;

          const lemma = getLemma(word);
          // If lemma is already known, skip
          if (knownSet.has(lemma)) continue;

          const freq = parsed.frequencyMap[word];
          const context = parsed.wordContexts[word]?.[0] || "";

          if (!lemmaMap.has(lemma)) {
            lemmaMap.set(lemma, {
              word,
              lemma,
              frequency: freq,
              context,
            });
          } else {
            // If another form appeared with higher frequency, prefer it, or sum frequencies
            const existing = lemmaMap.get(lemma)!;
            existing.frequency += freq;
            if (!existing.context && context) {
              existing.context = context;
            }
          }
        }

        const queue = Array.from(lemmaMap.values()).sort(
          (a, b) => b.frequency - a.frequency
        );

        setReviewQueue(queue);

        if (queue.length === 0) {
          setCompleted(true);
        } else {
          // Feature 3: History progress loader — resume where left off
          let savedIndex = 0;

          // Check server progress first
          if (data.reviewProgress && typeof data.reviewProgress.currentIndex === "number") {
            savedIndex = data.reviewProgress.currentIndex;
          } else {
            // Check localStorage fallback
            try {
              const local = localStorage.getItem(`wordbank_progress_${transcriptId}`);
              if (local) {
                const parsedLocal = JSON.parse(local);
                if (typeof parsedLocal.currentIndex === "number") {
                  savedIndex = parsedLocal.currentIndex;
                }
              }
            } catch {
              // ignore
            }
          }

          if (savedIndex >= queue.length) {
            setCompleted(true);
          } else if (savedIndex > 0) {
            setCurrentIndex(savedIndex);
            setResumeNotice(`Resumed where you left off (Card ${savedIndex + 1} of ${queue.length})`);
            setTimeout(() => setResumeNotice(null), 4000);
          }
        }
      } catch {
        // handle error
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [transcriptId, router]);

  // Go to previous word ("<-" key or button)
  const handlePrevious = useCallback(() => {
    if (currentIndex <= 0) return;
    setDirection(-1);
    setShowLearn(false);
    setDefinition(null);
    const newIdx = currentIndex - 1;
    setCurrentIndex(newIdx);
    setCompleted(false);
    persistProgress(newIdx, false);
  }, [currentIndex, persistProgress]);

  // Save word and advance
  const saveWord = useCallback(
    async (status: "known" | "learned") => {
      if (savingWord || currentIndex >= reviewQueue.length) return;
      setSavingWord(true);

      const current = reviewQueue[currentIndex];
      try {
        await fetch("/api/words", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: current.word,
            status,
            definitionData: definition,
            firstSeenContext: current.context,
            frequency: current.frequency,
          }),
        });
      } catch {
        // Continue even if save fails
      }

      setShowLearn(false);
      setDefinition(null);
      setDirection(1);
      setSavingWord(false);

      const nextIndex = currentIndex + 1;
      if (nextIndex >= reviewQueue.length) {
        setCompleted(true);
        persistProgress(nextIndex, true);
      } else {
        setCurrentIndex(nextIndex);
        persistProgress(nextIndex, false);
      }
    },
    [currentIndex, reviewQueue, definition, savingWord, persistProgress]
  );

  // Fetch definition for learn mode
  const openLearn = useCallback(async () => {
    if (currentIndex >= reviewQueue.length) return;
    const current = reviewQueue[currentIndex];
    setShowLearn(true);
    setDefLoading(true);

    try {
      const contextParam = current.context
        ? `&context=${encodeURIComponent(current.context)}`
        : "";
      const res = await fetch(
        `/api/definition?word=${encodeURIComponent(current.word)}${contextParam}`
      );
      if (!res.ok) throw new Error("Fetch failed");
      const data: DefinitionData = await res.json();
      setDefinition({
        ...data,
        synonyms: data.synonyms || [],
      });
    } catch {
      setDefinition({
        word: current.word,
        phonetic: null,
        audioUrl: null,
        partOfSpeech: "unknown",
        definition: "Could not load definition",
        example: null,
        synonyms: [],
        allMeanings: [],
        found: false,
      });
    } finally {
      setDefLoading(false);
    }
  }, [currentIndex, reviewQueue]);

  // Keyboard handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if in an input/textarea
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;

      if (completed) return;

      // Feature 2: "<-" (ArrowLeft) or Backspace goes backwards
      if (e.code === "ArrowLeft") {
        e.preventDefault();
        handlePrevious();
        return;
      }

      if (showLearn) {
        // In learn mode: Enter or Space = "Got it"
        if (e.code === "Enter" || e.code === "Space") {
          e.preventDefault();
          saveWord("learned");
        }
        // Escape = go back to review card
        if (e.code === "Escape") {
          e.preventDefault();
          setShowLearn(false);
          setDefinition(null);
        }
        return;
      }

      // In review mode: Space = "I know this"
      if (e.code === "Space") {
        e.preventDefault();
        saveWord("known");
      } else if (
        e.code !== "Tab" &&
        e.code !== "Escape" &&
        e.code !== "ArrowRight" &&
        e.code !== "ArrowDown" &&
        e.code !== "ArrowUp" &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey
      ) {
        e.preventDefault();
        openLearn();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showLearn, completed, saveWord, openLearn, handlePrevious]);

  if (loading) {
    return (
      <>
        <Navbar />
        <main className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
        </main>
      </>
    );
  }

  if (!transcript || reviewQueue.length === 0 || completed) {
    return (
      <>
        <Navbar />
        <main className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center px-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center"
          >
            <div className="mb-6 text-5xl">✓</div>
            <h1 className="mb-2 text-2xl font-bold">
              {completed ? "Review Completed!" : "No Words to Review"}
            </h1>
            <p className="mb-8 text-muted-foreground">
              {completed
                ? "You've reviewed all the words from this transcript. Your progress has been saved!"
                : "All words from this transcript are already in your Word Bank (including variations)."}
            </p>
            <div className="flex gap-3 justify-center">
              {currentIndex > 0 && (
                <button
                  onClick={handlePrevious}
                  className="rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-medium transition-all hover:bg-accent"
                >
                  ← Review Previous Word
                </button>
              )}
              <button
                onClick={() => router.push(`/analysis/${transcriptId}`)}
                className="rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-medium transition-all hover:bg-accent"
              >
                ← Analysis
              </button>
              <button
                onClick={() => router.push("/wordbank")}
                className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:brightness-110"
              >
                View Word Bank
              </button>
            </div>
          </motion.div>
        </main>
      </>
    );
  }

  const current = reviewQueue[currentIndex];
  const progress = (currentIndex + 1) / reviewQueue.length;

  return (
    <>
      <Navbar />
      <main className="flex min-h-[calc(100vh-3.5rem)] flex-col">
        {/* Progress bar and session status */}
        <div className="border-b border-border/30 bg-card/50">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
            <div className="flex items-center gap-3">
              {/* Feature 2: Previous Button */}
              <button
                onClick={handlePrevious}
                disabled={currentIndex === 0}
                title="Go back to previous word (or press Left Arrow ←)"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-card px-3 py-1 text-xs font-medium text-muted-foreground transition-all hover:border-primary/40 hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
              >
                <span>←</span>
                <span>Previous</span>
              </button>

              <span className="text-sm font-medium text-foreground truncate max-w-xs sm:max-w-md">
                {transcript.title}
              </span>
            </div>

            <span className="text-sm font-medium tabular-nums">
              <span className="text-primary font-bold">{currentIndex + 1}</span>
              <span className="text-muted-foreground"> / {reviewQueue.length}</span>
            </span>
          </div>

          <div className="h-1 bg-muted relative overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-primary to-blue-400"
              initial={{ width: 0 }}
              animate={{ width: `${progress * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>

        {/* Resume notification banner */}
        <AnimatePresence>
          {resumeNotice && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mx-auto mt-4 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs text-primary shadow-sm"
            >
              ⏱ {resumeNotice}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Card area */}
        <div className="flex flex-1 items-center justify-center px-6 py-12">
          <AnimatePresence mode="wait" custom={direction}>
            {!showLearn ? (
              // ── Review Card ──
              <motion.div
                key={`review-${currentIndex}`}
                custom={direction}
                initial={{ opacity: 0, x: 70 * direction, scale: 0.96 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: -70 * direction, scale: 0.96 }}
                transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                className="w-full max-w-lg"
              >
                <div className="rounded-2xl border border-border/60 bg-card p-10 text-center shadow-xl shadow-black/10 relative overflow-hidden backdrop-blur-sm">
                  {/* Frequency badge & Word root indicator */}
                  <div className="mb-8 flex items-center justify-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                      appears {current.frequency}×
                    </span>
                    {current.lemma && current.lemma !== current.word.toLowerCase() && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[11px] text-muted-foreground">
                        root: <span className="font-semibold text-foreground">{current.lemma}</span>
                      </span>
                    )}
                  </div>

                  {/* Word */}
                  <h2 className="mb-6 text-5xl font-bold tracking-tight">
                    {current.word}
                  </h2>

                  {/* Context */}
                  {current.context && (
                    <p className="mx-auto max-w-md text-sm italic text-muted-foreground leading-relaxed">
                      &ldquo;...{current.context}...&rdquo;
                    </p>
                  )}

                  {/* Quick Action Buttons for Mouse / Touch Users */}
                  <div className="mt-8 flex items-center justify-center gap-3 pt-4 border-t border-border/30">
                    <button
                      onClick={handlePrevious}
                      disabled={currentIndex === 0}
                      className="rounded-xl border border-border bg-background px-4 py-2 text-xs font-medium text-muted-foreground transition-all hover:bg-accent disabled:opacity-30"
                    >
                      ← Back
                    </button>
                    <button
                      onClick={() => saveWord("known")}
                      disabled={savingWord}
                      className="rounded-xl bg-primary/10 px-5 py-2 text-xs font-semibold text-primary transition-all hover:bg-primary/20"
                    >
                      I Know This (Space)
                    </button>
                    <button
                      onClick={openLearn}
                      className="rounded-xl bg-card border border-border px-5 py-2 text-xs font-semibold text-foreground transition-all hover:bg-accent"
                    >
                      Learn (Any key)
                    </button>
                  </div>
                </div>
              </motion.div>
            ) : (
              // ── Learn Card ──
              <motion.div
                key={`learn-${currentIndex}`}
                initial={{ opacity: 0, y: 30, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.97 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="w-full max-w-lg"
              >
                <div className="rounded-2xl border border-border/60 bg-card p-8 shadow-xl shadow-black/10">
                  {defLoading ? (
                    <div className="flex flex-col items-center py-12">
                      <div className="mb-4 h-6 w-6 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
                      <p className="text-sm text-muted-foreground">
                        Looking up &ldquo;{current.word}&rdquo;...
                      </p>
                    </div>
                  ) : definition ? (
                    <>
                      {/* Word header */}
                      <div className="mb-6">
                        <div className="flex items-baseline gap-3">
                          <h2 className="text-3xl font-bold">
                            {current.word}
                          </h2>
                          {definition.phonetic && (
                            <span className="text-sm text-muted-foreground">
                              {definition.phonetic}
                            </span>
                          )}
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <span className="inline-block rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
                            {definition.partOfSpeech}
                          </span>
                          {current.lemma && current.lemma !== current.word.toLowerCase() && (
                            <span className="text-xs text-muted-foreground">
                              Base form: <strong className="text-foreground">{current.lemma}</strong>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Definition */}
                      <div className="mb-5 rounded-xl bg-muted/50 p-4">
                        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Definition
                        </p>
                        <p className="text-sm leading-relaxed">
                          {definition.definition}
                        </p>
                      </div>

                      {/* Example from API */}
                      {definition.example && (
                        <div className="mb-5 rounded-xl bg-muted/50 p-4">
                          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Example
                          </p>
                          <p className="text-sm italic leading-relaxed text-muted-foreground">
                            &ldquo;{definition.example}&rdquo;
                          </p>
                        </div>
                      )}

                      {/* Context from transcript */}
                      {current.context && (
                        <div className="mb-5 rounded-xl border border-primary/20 bg-primary/5 p-4">
                          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-primary/70">
                            From Transcript
                          </p>
                          <p className="text-sm italic leading-relaxed text-muted-foreground">
                            &ldquo;...{current.context}...&rdquo;
                          </p>
                        </div>
                      )}

                      {/* Synonyms */}
                      {definition.synonyms && definition.synonyms.length > 0 && (
                        <div className="mb-6">
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Synonyms
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {definition.synonyms.map((s) => (
                              <span
                                key={s}
                                className="rounded-md border border-border/50 bg-background px-2 py-1 text-xs"
                              >
                                {s}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Got it button */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setShowLearn(false);
                            setDefinition(null);
                          }}
                          className="rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium text-muted-foreground hover:bg-accent"
                        >
                          Cancel (Esc)
                        </button>
                        <button
                          onClick={() => saveWord("learned")}
                          disabled={savingWord}
                          className="flex-1 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-600/25 transition-all hover:brightness-110 disabled:opacity-50"
                        >
                          {savingWord ? "Saving..." : "Got it ✓ (Enter / Space)"}
                        </button>
                      </div>
                    </>
                  ) : null}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Keyboard hints */}
        <div className="border-t border-border/30 bg-card/50">
          <div className="mx-auto flex max-w-5xl items-center justify-center flex-wrap gap-6 px-6 py-3">
            {!showLearn ? (
              <>
                <button
                  onClick={handlePrevious}
                  disabled={currentIndex === 0}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground disabled:opacity-40"
                >
                  <kbd className="kbd">←</kbd>
                  Previous
                </button>
                <span className="text-border">·</span>
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  <kbd className="kbd">Space</kbd>
                  I know this
                </span>
                <span className="text-border">·</span>
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  <kbd className="kbd">Any key</kbd>
                  Learn it
                </span>
              </>
            ) : (
              <>
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  <kbd className="kbd">Enter</kbd>
                  Got it
                </span>
                <span className="text-border">·</span>
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  <kbd className="kbd">Esc</kbd>
                  Back
                </span>
              </>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
