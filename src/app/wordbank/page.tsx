"use client";

import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Navbar from "@/components/layout/navbar";

interface Word {
  id: string;
  text: string;
  definitionData: {
    word?: string;
    phonetic?: string;
    partOfSpeech?: string;
    definition?: string;
    example?: string;
    synonyms?: string[];
    found?: boolean;
  } | null;
  status: string;
  firstSeenContext: string | null;
  frequency: number | null;
  addedAt: string;
}

type SortOption = "recent" | "alphabetical" | "frequency";
type FilterOption = "all" | "known" | "learned";

export default function WordBankPage() {
  const [words, setWords] = useState<Word[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOption>("recent");
  const [filter, setFilter] = useState<FilterOption>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchWords = async () => {
    try {
      const res = await fetch(
        `/api/words?sort=${sort}&status=${filter === "all" ? "" : filter}`
      );
      const data = await res.json();
      if (Array.isArray(data)) setWords(data);
    } catch {
      // handle error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort, filter]);

  const filteredWords = useMemo(() => {
    if (!search.trim()) return words;
    const q = search.toLowerCase();
    return words.filter((w) => w.text.includes(q));
  }, [words, search]);

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      await fetch(`/api/words/${id}`, { method: "DELETE" });
      setWords((prev) => prev.filter((w) => w.id !== id));
      if (expandedId === id) setExpandedId(null);
    } catch {
      // handle error
    } finally {
      setDeleting(null);
    }
  };

  const sortOptions: { value: SortOption; label: string }[] = [
    { value: "recent", label: "Recent" },
    { value: "alphabetical", label: "A → Z" },
    { value: "frequency", label: "Frequency" },
  ];

  const filterOptions: { value: FilterOption; label: string }[] = [
    { value: "all", label: "All" },
    { value: "known", label: "Known" },
    { value: "learned", label: "Learned" },
  ];

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-3xl px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Header */}
          <div className="mb-8 flex items-start justify-between">
            <div>
              <h1 className="mb-1 text-2xl font-bold tracking-tight">
                Word Bank
              </h1>
              <p className="text-sm text-muted-foreground">
                {words.length} word{words.length !== 1 ? "s" : ""} saved
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-blue-400" />
                {words.filter((w) => w.status === "known").length} known
              </span>
              <span className="text-border">·</span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                {words.filter((w) => w.status === "learned").length} learned
              </span>
            </div>
          </div>

          {/* Search */}
          <div className="mb-6">
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                ⌕
              </span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search words..."
                className="w-full rounded-xl border border-border bg-card pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
          </div>

          {/* Filters */}
          <div className="mb-6 flex flex-wrap items-center gap-3">
            {/* Status filter */}
            <div className="flex gap-1 rounded-lg bg-muted p-1">
              {filterOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setFilter(opt.value)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                    filter === opt.value
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Sort */}
            <div className="flex gap-1 rounded-lg bg-muted p-1">
              {sortOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setSort(opt.value)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                    sort === opt.value
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Word list */}
          {loading ? (
            <div className="flex justify-center py-20">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
            </div>
          ) : filteredWords.length === 0 ? (
            <div className="py-20 text-center">
              <div className="mb-4 text-4xl">◇</div>
              <p className="text-sm text-muted-foreground">
                {words.length === 0
                  ? "Your Word Bank is empty. Upload a transcript to get started."
                  : "No words match your search."}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <AnimatePresence initial={false}>
                {filteredWords.map((word) => (
                  <motion.div
                    key={word.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className="rounded-xl border border-border/50 bg-card overflow-hidden"
                  >
                    {/* Row */}
                    <button
                      onClick={() =>
                        setExpandedId(
                          expandedId === word.id ? null : word.id
                        )
                      }
                      className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-accent/50"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-base font-semibold">
                          {word.text}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            word.status === "learned"
                              ? "bg-emerald-500/10 text-emerald-400"
                              : "bg-blue-500/10 text-blue-400"
                          }`}
                        >
                          {word.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        {word.frequency && (
                          <span className="text-xs text-muted-foreground">
                            ×{word.frequency}
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {new Date(word.addedAt).toLocaleDateString()}
                        </span>
                        <span
                          className={`text-muted-foreground transition-transform ${
                            expandedId === word.id ? "rotate-180" : ""
                          }`}
                        >
                          ▾
                        </span>
                      </div>
                    </button>

                    {/* Expanded detail */}
                    <AnimatePresence>
                      {expandedId === word.id && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25 }}
                          className="overflow-hidden"
                        >
                          <div className="border-t border-border/30 px-5 py-4 space-y-3">
                            {word.definitionData?.definition && (
                              <div>
                                <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                  Definition
                                  {word.definitionData.partOfSpeech &&
                                    ` · ${word.definitionData.partOfSpeech}`}
                                </p>
                                <p className="text-sm leading-relaxed">
                                  {word.definitionData.definition}
                                </p>
                              </div>
                            )}

                            {word.definitionData?.example && (
                              <div>
                                <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                  Example
                                </p>
                                <p className="text-sm italic text-muted-foreground">
                                  &ldquo;{word.definitionData.example}&rdquo;
                                </p>
                              </div>
                            )}

                            {word.firstSeenContext && (
                              <div>
                                <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                  Original Context
                                </p>
                                <p className="text-sm italic text-muted-foreground">
                                  &ldquo;...{word.firstSeenContext}...&rdquo;
                                </p>
                              </div>
                            )}

                            {word.definitionData?.synonyms &&
                              word.definitionData.synonyms.length > 0 && (
                                <div>
                                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                    Synonyms
                                  </p>
                                  <div className="flex flex-wrap gap-1.5">
                                    {word.definitionData.synonyms.map(
                                      (s: string) => (
                                        <span
                                          key={s}
                                          className="rounded-md border border-border/50 bg-background px-2 py-1 text-xs"
                                        >
                                          {s}
                                        </span>
                                      )
                                    )}
                                  </div>
                                </div>
                              )}

                            <div className="flex justify-end pt-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(word.id);
                                }}
                                disabled={deleting === word.id}
                                className="rounded-lg px-3 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
                              >
                                {deleting === word.id
                                  ? "Removing..."
                                  : "Remove from bank"}
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </motion.div>
      </main>
    </>
  );
}
