import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

function getGroqApiKey(): string | undefined {
  if (process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.trim()) {
    return process.env.GROQ_API_KEY.trim();
  }
  try {
    const envPath = path.join(process.cwd(), ".env");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf-8");
      const match = content.match(/^GROQ_API_KEY=["']?([^"'\r\n]+)["']?/m);
      if (match?.[1]?.trim()) {
        return match[1].trim();
      }
    }
  } catch (e) {
    console.error("Failed to read .env file for GROQ_API_KEY", e);
  }
  return undefined;
}

const CANDIDATE_MODELS = [
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b",
  "qwen/qwen3.8-27b",
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
];

let cachedWorkingModel: string | null = null;

async function fetchFromGroq(word: string, context?: string | null) {
  const apiKey = getGroqApiKey();
  if (!apiKey) return null;

  const contextPrompt = context
    ? `\nThe word appeared in this transcript context: "${context}". Use this context to choose the most accurate meaning.`
    : "";

  const prompt = `Provide the dictionary definition and details for the English word "${word}".${contextPrompt}

Respond strictly with a JSON object with these keys:
{
  "word": "${word}",
  "phonetic": "/.../",
  "partOfSpeech": "verb | noun | adjective | adverb | etc.",
  "definition": "concise, accurate definition",
  "example": "an example sentence showing its use",
  "synonyms": ["synonym1", "synonym2", "synonym3"]
}`;

  const modelsToTry = cachedWorkingModel
    ? [cachedWorkingModel, ...CANDIDATE_MODELS.filter((m) => m !== cachedWorkingModel)]
    : CANDIDATE_MODELS;

  for (const model of modelsToTry) {
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "system",
              content:
                "You are an accurate, concise English dictionary. Always output valid JSON only.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          response_format: { type: "json_object" },
          temperature: 0.1,
        }),
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.warn(`Groq model ${model} failed (${res.status}): ${errorText.slice(0, 100)}`);
        continue;
      }

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content) continue;

      const parsed = JSON.parse(content);
      cachedWorkingModel = model;

      const wordOut = parsed.word || word;
      const phoneticOut = parsed.phonetic || parsed.pronunciation || null;
      const partOfSpeechOut = parsed.partOfSpeech || parsed.part_of_speech || "word";
      const definitionOut =
        parsed.definition ||
        (Array.isArray(parsed.definitions) ? parsed.definitions[0] : null) ||
        "No definition found";
      const exampleOut =
        parsed.example ||
        (Array.isArray(parsed.examples) ? parsed.examples[0] : null) ||
        null;
      const synonymsOut = Array.isArray(parsed.synonyms)
        ? parsed.synonyms.slice(0, 6)
        : [];

      return {
        word: wordOut,
        phonetic: phoneticOut,
        audioUrl: null,
        partOfSpeech: partOfSpeechOut,
        definition: definitionOut,
        example: exampleOut,
        synonyms: synonymsOut,
        allMeanings: [
          {
            partOfSpeech: partOfSpeechOut,
            definition: definitionOut,
            example: exampleOut,
          },
        ],
        found: true,
        source: `groq (${model})`,
      };
    } catch (err) {
      console.warn(`Attempt with Groq model ${model} failed:`, err);
    }
  }

  return null;
}

async function fetchFromDictionaryApi(word: string) {
  try {
    const response = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
      {
        next: { revalidate: 86400 },
        signal: AbortSignal.timeout(2000),
      }
    );

    if (!response.ok) return null;

    const data = await response.json();
    const entry = Array.isArray(data) ? data[0] : null;
    if (!entry) return null;

    const meanings = entry.meanings || [];
    const firstMeaning = meanings[0] || {};
    const firstDef = firstMeaning.definitions?.[0] || {};

    return {
      word: entry.word || word,
      phonetic: entry.phonetic || entry.phonetics?.[0]?.text || null,
      audioUrl: entry.phonetics?.find((p: { audio?: string }) => p.audio)?.audio || null,
      partOfSpeech: firstMeaning.partOfSpeech || "unknown",
      definition: firstDef.definition || "No definition found",
      example: firstDef.example || null,
      synonyms: firstMeaning.synonyms?.slice(0, 5) || [],
      allMeanings: meanings.map(
        (m: {
          partOfSpeech?: string;
          definitions?: Array<{ definition?: string; example?: string }>;
        }) => ({
          partOfSpeech: m.partOfSpeech,
          definition: m.definitions?.[0]?.definition,
          example: m.definitions?.[0]?.example,
        })
      ),
      found: true,
      source: "dictionary-api",
    };
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const word = searchParams.get("word");
    const context = searchParams.get("context");

    if (!word) {
      return NextResponse.json(
        { error: "word parameter is required" },
        { status: 400 }
      );
    }

    // 1. If Groq API key is configured, use Groq (fast, context-aware, 100% coverage)
    const apiKey = getGroqApiKey();
    if (apiKey) {
      const groqResult = await fetchFromGroq(word, context);
      if (groqResult) {
        return NextResponse.json(groqResult);
      }
    }

    // 2. Try Free Dictionary API
    const dictResult = await fetchFromDictionaryApi(word);
    if (dictResult) {
      return NextResponse.json(dictResult);
    }

    // 3. Fallback when neither source has the definition
    return NextResponse.json(
      {
        word,
        definition: "No definition found",
        partOfSpeech: "unknown",
        example: null,
        phonetic: null,
        audioUrl: null,
        synonyms: [],
        allMeanings: [],
        found: false,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Definition fetch error:", error);
    return NextResponse.json(
      {
        word: "",
        definition: "Could not load definition",
        partOfSpeech: "unknown",
        example: null,
        phonetic: null,
        audioUrl: null,
        synonyms: [],
        allMeanings: [],
        found: false,
      },
      { status: 200 }
    );
  }
}
