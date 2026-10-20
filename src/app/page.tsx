"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Navbar from "@/components/layout/navbar";

interface ReviewProgress {
  currentIndex: number;
  completed: boolean;
  updatedAt?: string;
}

interface Transcript {
  id: string;
  title: string;
  uploadedAt: string;
  wordCount: number;
  uniqueWordCount: number;
  reviewProgress?: ReviewProgress | null;
}

interface UserProfile {
  id: string;
  email: string;
  name?: string | null;
}

export default function HomePage() {
  const router = useRouter();
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [wordCount, setWordCount] = useState(0);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (data.user) {
          setUser(data.user);
          // Fetch user data
          fetch("/api/transcripts")
            .then((r) => r.json())
            .then((d) => {
              if (Array.isArray(d)) setTranscripts(d);
            })
            .catch(() => {});

          fetch("/api/words")
            .then((r) => r.json())
            .then((d) => {
              if (Array.isArray(d)) setWordCount(d.length);
            })
            .catch(() => {});
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
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
          className="mb-16 text-center"
        >
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border/60 bg-card px-4 py-1.5 text-sm text-muted-foreground shadow-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            {user ? `Logged in as ${user.email}` : "Keyboard-driven vocabulary learning"}
          </div>

          <h1 className="mb-4 text-5xl font-bold tracking-tight sm:text-6xl">
            Build your{" "}
            <span className="bg-gradient-to-r from-blue-400 via-blue-500 to-indigo-500 bg-clip-text text-transparent">
              Word Bank
            </span>
          </h1>
          <p className="mx-auto mb-10 max-w-xl text-lg text-muted-foreground leading-relaxed">
            Upload transcripts, discover vocabulary patterns, and master new
            words — one card at a time with smart inflection recognition.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4">
            {user ? (
              <>
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
                    <span className="ml-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary font-semibold">
                      {wordCount}
                    </span>
                  )}
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:shadow-xl hover:shadow-primary/30 hover:brightness-110"
                >
                  Sign In to Your Account →
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-6 py-3 text-sm font-medium text-foreground transition-all hover:bg-accent"
                >
                  Create Account
                </Link>
              </>
            )}
          </div>
        </motion.div>

        {/* User Resume Banner if there's an ongoing transcript */}
        {user && transcripts.length > 0 && (() => {
          const inProgress = transcripts.find(
            (t) => t.reviewProgress && !t.reviewProgress.completed && t.reviewProgress.currentIndex > 0
          );
          if (!inProgress || !inProgress.reviewProgress) return null;
          return (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mb-12 rounded-2xl border border-primary/30 bg-primary/5 p-6 backdrop-blur-sm"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider mb-1">
                    <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                    Resume where you left off
                  </div>
                  <h3 className="text-base font-bold text-foreground">
                    {inProgress.title}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Card {inProgress.reviewProgress.currentIndex + 1} of{" "}
                    {inProgress.uniqueWordCount} words reviewed
                  </p>
                </div>
                <Link
                  href={`/review/${inProgress.id}`}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-semibold text-primary-foreground shadow-md hover:brightness-110"
                >
                  Resume Review →
                </Link>
              </div>
            </motion.div>
          );
        })()}

        {/* How it works */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
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
                desc: "Cards with keyboard shortcuts (Space / Any key / ←)",
              },
              {
                step: "04",
                title: "Smart Bank",
                desc: "Recognizes word families (like, likes, liked, liking)",
              },
            ].map((item, i) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.2 + i * 0.1 }}
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
        {user && transcripts.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <h2 className="mb-6 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              Your Transcripts
            </h2>
            <div className="space-y-3">
              {transcripts.map((t) => {
                const prog = t.reviewProgress;
                return (
                  <div
                    key={t.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-border/50 bg-card p-4 transition-all hover:border-primary/30 hover:bg-accent/40"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/analysis/${t.id}`}
                          className="text-sm font-semibold hover:text-primary transition-colors"
                        >
                          {t.title}
                        </Link>
                        {prog?.completed ? (
                          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                            Completed ✓
                          </span>
                        ) : prog && prog.currentIndex > 0 ? (
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                            In Progress ({prog.currentIndex + 1} reviewed)
                          </span>
                        ) : null}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(t.uploadedAt).toLocaleDateString()} ·{" "}
                        {t.wordCount.toLocaleString()} words ·{" "}
                        {t.uniqueWordCount.toLocaleString()} unique
                      </p>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <Link
                        href={`/analysis/${t.id}`}
                        className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-all"
                      >
                        Analysis
                      </Link>
                      <Link
                        href={`/review/${t.id}`}
                        className="rounded-lg bg-primary/10 px-3.5 py-1.5 text-xs font-semibold text-primary hover:bg-primary hover:text-primary-foreground transition-all"
                      >
                        {prog && prog.currentIndex > 0 && !prog.completed
                          ? "Resume Review →"
                          : "Review →"}
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </main>
    </>
  );
}
