"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Navbar from "@/components/layout/navbar";

interface Transcript {
  id: string;
  title: string;
  uploadedAt: string;
  wordCount: number;
  uniqueWordCount: number;
}

export default function HomePage() {
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [wordCount, setWordCount] = useState(0);

  useEffect(() => {
    fetch("/api/transcripts")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setTranscripts(data);
      })
      .catch(() => {});

    fetch("/api/words")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setWordCount(data.length);
      })
      .catch(() => {});
  }, []);

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-5xl px-6 py-16">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-20 text-center"
        >
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border/60 bg-card px-4 py-1.5 text-sm text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Keyboard-driven vocabulary learning
          </div>

          <h1 className="mb-4 text-5xl font-bold tracking-tight sm:text-6xl">
            Build your{" "}
            <span className="bg-gradient-to-r from-blue-400 via-blue-500 to-indigo-500 bg-clip-text text-transparent">
              Word Bank
            </span>
          </h1>
          <p className="mx-auto mb-10 max-w-xl text-lg text-muted-foreground leading-relaxed">
            Upload transcripts, discover vocabulary patterns, and learn new
            words — one card at a time.
          </p>

          <div className="flex items-center justify-center gap-4">
            <Link
              href="/upload"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:shadow-xl hover:shadow-primary/30 hover:brightness-110"
            >
              <span>↑</span>
              Upload Transcript
            </Link>
            <Link
              href="/wordbank"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-6 py-3 text-sm font-medium text-foreground transition-all hover:bg-accent"
            >
              <span>◆</span>
              View Word Bank
              {wordCount > 0 && (
                <span className="ml-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                  {wordCount}
                </span>
              )}
            </Link>
          </div>
        </motion.div>

        {/* How it works */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mb-20"
        >
          <h2 className="mb-8 text-center text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            How it works
          </h2>
          <div className="grid gap-4 sm:grid-cols-4">
            {[
              {
                step: "01",
                title: "Upload",
                desc: "Drop a transcript file or paste text",
              },
              {
                step: "02",
                title: "Analyze",
                desc: "See frequency, categories, and stats",
              },
              {
                step: "03",
                title: "Review",
                desc: "Cards for each unknown word, keyboard-driven",
              },
              {
                step: "04",
                title: "Learn",
                desc: "Get definitions, save to your Word Bank",
              },
            ].map((item, i) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.3 + i * 0.1 }}
                className="rounded-xl border border-border/50 bg-card p-5"
              >
                <span className="mb-3 block text-xs font-bold text-primary/60">
                  {item.step}
                </span>
                <h3 className="mb-1 text-sm font-semibold">{item.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {item.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Recent uploads */}
        {transcripts.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <h2 className="mb-6 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              Recent Uploads
            </h2>
            <div className="space-y-2">
              {transcripts.slice(0, 5).map((t) => (
                <Link
                  key={t.id}
                  href={`/analysis/${t.id}`}
                  className="flex items-center justify-between rounded-xl border border-border/50 bg-card px-5 py-4 transition-all hover:border-primary/30 hover:bg-accent"
                >
                  <div>
                    <h3 className="text-sm font-medium">{t.title}</h3>
                    <p className="text-xs text-muted-foreground">
                      {new Date(t.uploadedAt).toLocaleDateString()} ·{" "}
                      {t.wordCount.toLocaleString()} words ·{" "}
                      {t.uniqueWordCount.toLocaleString()} unique
                    </p>
                  </div>
                  <span className="text-muted-foreground">→</span>
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </main>
    </>
  );
}
