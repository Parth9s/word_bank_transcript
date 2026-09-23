import { STOPWORDS } from "./stopwords";

// ── Format Detection ──────────────────────────────────────────────────

export type TranscriptFormat = "srt" | "vtt" | "text";

export function detectFormat(text: string): TranscriptFormat {
  const trimmed = text.trim();
  if (trimmed.startsWith("WEBVTT")) return "vtt";
  // SRT: first non-empty line is a sequence number, followed by a timestamp line
  const lines = trimmed.split("\n").map((l) => l.trim());
  const firstNonEmpty = lines.find((l) => l.length > 0);
  if (firstNonEmpty && /^\d+$/.test(firstNonEmpty)) {
    // Check if second non-empty line looks like an SRT timestamp
    const idx = lines.indexOf(firstNonEmpty);
    const nextLine = lines.slice(idx + 1).find((l) => l.length > 0);
    if (nextLine && /\d{2}:\d{2}:\d{2}[,\.]\d{3}\s*-->/.test(nextLine)) {
      return "srt";
    }
  }
  return "text";
}

// ── SRT Parser ────────────────────────────────────────────────────────

export function parseSRT(text: string): string {
  return text
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();
      // Remove sequence numbers (standalone digits)
      if (/^\d+$/.test(trimmed)) return false;
      // Remove timestamp lines
      if (/\d{2}:\d{2}:\d{2}[,\.]\d{3}\s*-->/.test(trimmed)) return false;
      // Remove empty lines
      if (trimmed.length === 0) return false;
      return true;
    })
    .join(" ");
}

// ── VTT Parser ────────────────────────────────────────────────────────

export function parseVTT(text: string): string {
  return text
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();
      // Remove WEBVTT header and metadata
      if (trimmed === "WEBVTT") return false;
      if (trimmed.startsWith("NOTE")) return false;
      if (trimmed.startsWith("Kind:") || trimmed.startsWith("Language:"))
        return false;
      // Remove cue IDs (standalone identifiers)
      if (/^[\w-]+$/.test(trimmed) && !trimmed.includes(" ")) return false;
      // Remove timestamp lines
      if (/\d{2}:\d{2}:\d{2}\.\d{3}\s*-->/.test(trimmed)) return false;
      // Remove timestamp-only lines (less strict)
      if (/^\d{2}:\d{2}/.test(trimmed) && trimmed.includes("-->"))
        return false;
      // Remove empty lines
      if (trimmed.length === 0) return false;
      return true;
    })
    .map((line) => {
      // Strip inline VTT tags like <v Speaker>, <c>, <b>, etc.
      return line.replace(/<[^>]+>/g, "");
    })
    .join(" ");
}

// ── Tokenizer ─────────────────────────────────────────────────────────

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z'\s-]/g, " ") // keep apostrophes and hyphens
    .split(/\s+/)
    .map((w) => w.replace(/^['-]+|['-]+$/g, "")) // trim leading/trailing
    .filter((w) => w.length > 1); // drop single chars
}

// ── Stopword Removal ──────────────────────────────────────────────────

export function removeStopwords(words: string[]): string[] {
  return words.filter((w) => !STOPWORDS.has(w));
}

// ── Frequency Computation ─────────────────────────────────────────────

export function computeFrequency(words: string[]): Map<string, number> {
  const freq = new Map<string, number>();
  for (const word of words) {
    freq.set(word, (freq.get(word) || 0) + 1);
  }
  return freq;
}

// ── Sentence Extraction ───────────────────────────────────────────────

export function extractSentences(text: string, word: string): string[] {
  // Split into sentences, find ones containing the target word
  const sentences = text.split(/[.!?]+/).map((s) => s.trim());
  const lower = word.toLowerCase();
  return sentences
    .filter((s) => {
      const words = s.toLowerCase().split(/\s+/);
      return words.some(
        (w) => w.replace(/[^a-z']/g, "") === lower
      );
    })
    .slice(0, 3); // max 3 context sentences
}

// ── Categorization ────────────────────────────────────────────────────

export interface CategorizedWords {
  common: Array<{ word: string; frequency: number }>;
  moderate: Array<{ word: string; frequency: number }>;
  rare: Array<{ word: string; frequency: number }>;
}

export function categorize(
  freqMap: Map<string, number>
): CategorizedWords {
  const sorted = Array.from(freqMap.entries())
    .map(([word, frequency]) => ({ word, frequency }))
    .sort((a, b) => b.frequency - a.frequency);

  const total = sorted.length;
  const commonCutoff = Math.ceil(total * 0.2);

  const common: CategorizedWords["common"] = [];
  const moderate: CategorizedWords["moderate"] = [];
  const rare: CategorizedWords["rare"] = [];

  sorted.forEach((item, index) => {
    if (index < commonCutoff) {
      common.push(item);
    } else if (item.frequency === 1) {
      rare.push(item);
    } else {
      moderate.push(item);
    }
  });

  return { common, moderate, rare };
}

// ── Full Parse Pipeline ───────────────────────────────────────────────

export interface ParseResult {
  cleanedText: string;
  allWords: string[];
  filteredWords: string[];
  frequencyMap: Record<string, number>;
  categories: CategorizedWords;
  totalWordCount: number;
  uniqueWordCount: number;
  wordContexts: Record<string, string[]>;
}

export function parseTranscript(
  rawText: string,
  format?: TranscriptFormat
): ParseResult {
  const detectedFormat = format || detectFormat(rawText);

  // Step 1: Clean subtitle formatting
  let cleanedText: string;
  switch (detectedFormat) {
    case "srt":
      cleanedText = parseSRT(rawText);
      break;
    case "vtt":
      cleanedText = parseVTT(rawText);
      break;
    default:
      cleanedText = rawText;
  }

  // Step 2: Tokenize
  const allWords = tokenize(cleanedText);
  const totalWordCount = allWords.length;

  // Step 3: Remove stopwords
  const filteredWords = removeStopwords(allWords);

  // Step 4: Compute frequency
  const freqMap = computeFrequency(filteredWords);
  const uniqueWordCount = freqMap.size;

  // Step 5: Categorize
  const categories = categorize(freqMap);

  // Step 6: Extract context sentences for each unique word
  const wordContexts: Record<string, string[]> = {};
  for (const word of freqMap.keys()) {
    wordContexts[word] = extractSentences(cleanedText, word);
  }

  // Convert Map to plain object for JSON serialization
  const frequencyMap: Record<string, number> = {};
  freqMap.forEach((v, k) => {
    frequencyMap[k] = v;
  });

  return {
    cleanedText,
    allWords,
    filteredWords,
    frequencyMap,
    categories,
    totalWordCount,
    uniqueWordCount,
    wordContexts,
  };
}
