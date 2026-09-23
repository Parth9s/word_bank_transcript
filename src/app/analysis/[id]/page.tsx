"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import Navbar from "@/components/layout/navbar";

interface ParsedData {
  frequencyMap: Record<string, number>;
  categories: {
    common: Array<{ word: string; frequency: number }>;
    moderate: Array<{ word: string; frequency: number }>;
    rare: Array<{ word: string; frequency: number }>;
  };
  wordContexts: Record<string, string[]>;
  cleanedText: string;
}

interface TranscriptData {
  id: string;
  title: string;
  wordCount: number;
  uniqueWordCount: number;
  parsedData: ParsedData;
}

type CategoryTab = "common" | "moderate" | "rare";

export default function AnalysisPage() {
  const params = useParams();
  const router = useRouter();
  const [data, setData] = useState<TranscriptData | null>(null);
  const [knownTexts, setKnownTexts] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<CategoryTab>("common");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`/api/transcripts/${params.id}`);
        if (!res.ok) throw new Error("Not found");
        const transcript: TranscriptData = await res.json();
        setData(transcript);

        // Check which words are already known
        const allWords = Object.keys(
          transcript.parsedData.frequencyMap
        );
        if (allWords.length > 0) {
          const checkRes = await fetch("/api/words/check", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ words: allWords }),
          });
          const checkData = await checkRes.json();
          setKnownTexts(new Set(checkData.knownTexts || []));
        }
      } catch {
        // handle error
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [params.id]);

  if (loading) {
    return (
      <>
        <Navbar />
        <main className="mx-auto max-w-5xl px-6 py-16">
          <div className="flex items-center justify-center py-32">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
          </div>
        </main>
      </>
    );
  }

  if (!data) {
    return (
      <>
        <Navbar />
        <main className="mx-auto max-w-5xl px-6 py-16">
          <p className="text-center text-muted-foreground">
            Transcript not found.
          </p>
        </main>
      </>
    );
  }

  const parsed = data.parsedData;
  const totalUnique = Object.keys(parsed.frequencyMap).length;
  const knownCount = knownTexts.size;
  const newCount = totalUnique - knownCount;

  // Top 20 words for chart
  const topWords = Object.entries(parsed.frequencyMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([word, frequency]) => ({ word, frequency }));

  const categoryData = parsed.categories[activeTab];

  const tabs: { key: CategoryTab; label: string; count: number }[] = [
    { key: "common", label: "Common", count: parsed.categories.common.length },
    {
      key: "moderate",
      label: "Moderate",
      count: parsed.categories.moderate.length,
    },
    { key: "rare", label: "Rare / Unique", count: parsed.categories.rare.length },
  ];

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-5xl px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Header */}
          <div className="mb-10 flex items-start justify-between">
            <div>
              <h1 className="mb-1 text-2xl font-bold tracking-tight">
                {data.title}
              </h1>
              <p className="text-sm text-muted-foreground">
                Transcript analysis — vocabulary breakdown
              </p>
            </div>
            <button
              onClick={() => router.push(`/review/${params.id}`)}
              className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:shadow-xl hover:brightness-110"
            >
              Start Review →
            </button>
          </div>

          {/* Stats */}
          <div className="mb-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              {
                label: "Total Words",
                value: data.wordCount.toLocaleString(),
                color: "text-foreground",
              },
              {
                label: "Unique Words",
                value: totalUnique.toLocaleString(),
                color: "text-blue-400",
              },
              {
                label: "Already Known",
                value: knownCount.toLocaleString(),
                color: "text-emerald-400",
              },
              {
                label: "New Words",
                value: newCount.toLocaleString(),
                color: "text-amber-400",
              },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                className="rounded-xl border border-border/50 bg-card p-5"
              >
                <p className="mb-1 text-xs font-medium text-muted-foreground">
                  {stat.label}
                </p>
                <p className={`text-2xl font-bold ${stat.color}`}>
                  {stat.value}
                </p>
              </motion.div>
            ))}
          </div>

          {/* Chart */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mb-10 rounded-xl border border-border/50 bg-card p-6"
          >
            <h2 className="mb-6 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              Most Used Words
            </h2>
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topWords}
                  layout="vertical"
                  margin={{ top: 0, right: 20, bottom: 0, left: 0 }}
                >
                  <XAxis
                    type="number"
                    stroke="hsl(215, 20%, 40%)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    dataKey="word"
                    type="category"
                    width={100}
                    stroke="hsl(215, 20%, 55%)"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(224, 28%, 12%)",
                      border: "1px solid hsl(223, 25%, 20%)",
                      borderRadius: "12px",
                      fontSize: "13px",
                      color: "hsl(213, 31%, 91%)",
                    }}
                    cursor={{ fill: "hsl(217, 91%, 60%, 0.05)" }}
                  />
                  <Bar dataKey="frequency" radius={[0, 6, 6, 0]}>
                    {topWords.map((_, index) => (
                      <Cell
                        key={index}
                        fill={`hsl(217, 91%, ${60 - index * 1.5}%)`}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Categories */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="rounded-xl border border-border/50 bg-card p-6"
          >
            <h2 className="mb-6 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              Categorized Words
            </h2>

            {/* Tab bar */}
            <div className="mb-6 flex gap-1 rounded-lg bg-muted p-1">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-all ${
                    activeTab === tab.key
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab.label}
                  <span className="ml-1.5 text-xs opacity-60">
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Word list */}
            <div className="max-h-[400px] overflow-y-auto">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                {categoryData.map((item) => {
                  const isKnown = knownTexts.has(item.word);
                  return (
                    <div
                      key={item.word}
                      className={`flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                        isKnown
                          ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-400"
                          : "border-border/40 bg-background"
                      }`}
                    >
                      <span className="font-medium truncate mr-2">
                        {item.word}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        ×{item.frequency}
                      </span>
                    </div>
                  );
                })}
              </div>
              {categoryData.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No words in this category.
                </p>
              )}
            </div>
          </motion.div>
        </motion.div>
      </main>
    </>
  );
}
