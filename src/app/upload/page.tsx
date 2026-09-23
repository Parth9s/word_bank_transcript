"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Navbar from "@/components/layout/navbar";
import { detectFormat, type TranscriptFormat } from "@/lib/parser";

export default function UploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [rawText, setRawText] = useState("");
  const [title, setTitle] = useState("");
  const [detectedFormat, setDetectedFormat] = useState<TranscriptFormat | null>(
    null
  );
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");

  const handleTextInput = useCallback((text: string, fileName?: string) => {
    setRawText(text);
    setError("");
    if (fileName) {
      setTitle(fileName.replace(/\.(txt|srt|vtt)$/i, ""));
    }
    if (text.trim()) {
      setDetectedFormat(detectFormat(text));
    }
  }, []);

  const handleFile = useCallback(
    (file: File) => {
      if (file.size > 5 * 1024 * 1024) {
        setError("File is too large. Max 5MB.");
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        handleTextInput(text, file.name);
      };
      reader.readAsText(file);
    },
    [handleTextInput]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const text = e.clipboardData.getData("text");
      if (text) {
        e.preventDefault();
        handleTextInput(text);
      }
    },
    [handleTextInput]
  );

  const handleSubmit = async () => {
    if (!rawText.trim()) {
      setError("Please upload a file or paste some text.");
      return;
    }

    setIsUploading(true);
    setError("");

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title || "Untitled Transcript",
          rawText,
          format: detectedFormat,
        }),
      });

      if (!res.ok) throw new Error("Upload failed");

      const data = await res.json();
      router.push(`/analysis/${data.id}`);
    } catch {
      setError("Failed to process transcript. Please try again.");
      setIsUploading(false);
    }
  };

  const formatLabel: Record<TranscriptFormat, string> = {
    srt: "SubRip (.srt)",
    vtt: "WebVTT (.vtt)",
    text: "Plain Text",
  };

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-2xl px-6 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="mb-2 text-3xl font-bold tracking-tight">
            Upload Transcript
          </h1>
          <p className="mb-10 text-muted-foreground">
            Drop a file, pick one, or paste your transcript text below.
          </p>

          {/* Title input */}
          <div className="mb-6">
            <label
              htmlFor="title"
              className="mb-2 block text-sm font-medium text-muted-foreground"
            >
              Title (optional)
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. TED Talk — The Power of Vulnerability"
              className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            />
          </div>

          {/* Drop zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`relative cursor-pointer rounded-2xl border-2 border-dashed p-12 text-center transition-all duration-300 ${
              isDragOver
                ? "border-primary bg-primary/5 scale-[1.02]"
                : "border-border/60 bg-card/50 hover:border-primary/40 hover:bg-card"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.srt,.vtt"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
              className="hidden"
            />

            <motion.div
              animate={{ scale: isDragOver ? 1.1 : 1 }}
              transition={{ type: "spring", stiffness: 300 }}
              className="mb-4 text-4xl"
            >
              {rawText ? "✓" : "↑"}
            </motion.div>

            {rawText ? (
              <div>
                <p className="text-sm font-medium text-foreground">
                  {title || "Text loaded"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {rawText.length.toLocaleString()} characters
                </p>
              </div>
            ) : (
              <div>
                <p className="text-sm font-medium text-foreground">
                  Drag & drop your file here
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  .txt, .srt, .vtt — or click to browse
                </p>
              </div>
            )}
          </div>

          {/* Format badge */}
          <AnimatePresence>
            {detectedFormat && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-4 flex items-center gap-2"
              >
                <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                  {formatLabel[detectedFormat]}
                </span>
                {detectedFormat !== "text" && (
                  <span className="text-xs text-muted-foreground">
                    Timestamps will be stripped automatically
                  </span>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Or paste */}
          <div className="my-8 flex items-center gap-4">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs font-medium text-muted-foreground">
              OR PASTE TEXT
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <textarea
            value={rawText}
            onChange={(e) => handleTextInput(e.target.value)}
            onPaste={handlePaste}
            placeholder="Paste your transcript here..."
            rows={6}
            className="w-full resize-none rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
          />

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-4 text-sm text-destructive"
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={isUploading || !rawText.trim()}
            className="mt-8 w-full rounded-xl bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:shadow-xl hover:shadow-primary/30 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
          >
            {isUploading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
                Analyzing...
              </span>
            ) : (
              "Analyze Transcript"
            )}
          </button>
        </motion.div>
      </main>
    </>
  );
}
