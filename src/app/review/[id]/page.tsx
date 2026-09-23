"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Navbar from "@/components/layout/navbar";

interface ParsedData {
  frequencyMap: Record<string, number>;
  wordContexts: Record<string, string[]>;
  cleanedText: string;
}

interface TranscriptData {
  id: string;
  title: string;
  parsedData: ParsedData;
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
  frequency: number;
  context: string;
}

export default function ReviewPage() {
  const params = useParams();
  const router = useRouter();
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

  // Load transcript and filter out known words
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/transcripts/${params.id}`);
        if (!res.ok) throw new Error("Not found");
        const data: TranscriptData = await res.json();
        setTranscript(data);

        const parsed = data.parsedData;
        const allWords = Object.keys(parsed.frequencyMap);

        // Check which are already known
        const checkRes = await fetch("/api/words/check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ words: allWords }),
        });
        const checkData = await checkRes.json();
        const knownSet = new Set<string>(checkData.knownTexts || []);

        // Build review queue — only unknown words, sorted by frequency desc
        const queue: ReviewWord[] = allWords
          .filter((w) => !knownSet.has(w))
          .map((word) => ({
            word,
            frequency: parsed.frequencyMap[word],
            context: parsed.wordContexts[word]?.[0] || "",
          }))
          .sort((a, b) => b.frequency - a.frequency);

        setReviewQueue(queue);
        if (queue.length === 0) setCompleted(true);
      } catch {
        // handle error
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [params.id]);

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

      if (currentIndex + 1 >= reviewQueue.length) {
        setCompleted(true);
      } else {
        setCurrentIndex((prev) => prev + 1);
      }
    },
    [currentIndex, reviewQueue, definition, savingWord]
  );

  // Fetch definition for learn mode
  const openLearn = useCallback(async () => {
    if (currentIndex >= reviewQueue.length) return;
    const current = reviewQueue[currentIndex];
    setShowLearn(true);
    setDefLoading(true);

    try {
      const contextParam = current.context ? `&context=${encodeURIComponent(current.context)}` : "";
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

      // In review mode
      if (e.code === "Space") {
        e.preventDefault();
        saveWord("known");
      } else if (
        e.code !== "Tab" &&
        e.code !== "Escape" &&
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
  }, [showLearn, completed, saveWord, openLearn]);

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

  if (!transcript || reviewQueue.length === 0) {
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
              {completed ? "All Done!" : "No Words to Review"}
            </h1>
            <p className="mb-8 text-muted-foreground">
              {completed
                ? "You've reviewed all the new words from this transcript."
                : "All words from this transcript are already in your Word Bank."}
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => router.push(`/analysis/${params.id}`)}
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
  const progress = currentIndex / reviewQueue.length;

  return (
    <>
      <Navbar />
      <main className="flex min-h-[calc(100vh-3.5rem)] flex-col">
        {/* Progress bar */}
        <div className="border-b border-border/30 bg-card/50">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
            <span className="text-sm text-muted-foreground">
              {transcript.title}
            </span>
            <span className="text-sm font-medium tabular-nums">
              <span className="text-primary">{currentIndex + 1}</span>
              <span className="text-muted-foreground">
                {" "}
                / {reviewQueue.length}
              </span>
            </span>
          </div>
          <div className="h-0.5 bg-muted">
            <motion.div
              className="h-full bg-primary"
              initial={{ width: 0 }}
              animate={{ width: `${progress * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>

        {/* Card area */}
        <div className="flex flex-1 items-center justify-center px-6 py-12">
          <AnimatePresence mode="wait" custom={direction}>
            {!showLearn ? (
              // ── Review Card ──
              <motion.div
                key={`review-${currentIndex}`}
                custom={direction}
                initial={{ opacity: 0, x: 60 * direction, scale: 0.97 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: -60 * direction, scale: 0.97 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="w-full max-w-lg"
              >
                <div className="rounded-2xl border border-border/50 bg-card p-10 text-center shadow-xl shadow-black/10">
                  {/* Frequency badge */}
                  <div className="mb-8 flex justify-center">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                      appears {current.frequency}×
                    </span>
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
                <div className="rounded-2xl border border-border/50 bg-card p-8 shadow-xl shadow-black/10">
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
                        <span className="mt-1 inline-block rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
                          {definition.partOfSpeech}
                        </span>
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
                      <button
                        onClick={() => saveWord("learned")}
                        disabled={savingWord}
                        className="w-full rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-600/25 transition-all hover:brightness-110 disabled:opacity-50"
                      >
                        {savingWord ? "Saving..." : "Got it ✓"}
                      </button>
                    </>
                  ) : null}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Keyboard hints */}
        <div className="border-t border-border/30 bg-card/50">
          <div className="mx-auto flex max-w-5xl items-center justify-center gap-8 px-6 py-3">
            {!showLearn ? (
              <>
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
