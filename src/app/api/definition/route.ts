import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

async function fetchFromGroq(word: string, context?: string | null) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  try {
    const contextPrompt = context ? `\nThe word appeared in this transcript context: "${context}". Use this context to choose the most appropriate meaning.` : "";
    const prompt = `Provide the dictionary definition and details for the English word "${word}".${contextPrompt}

Respond strictly with a JSON object in this exact structure:
{
  "word": "${word}",
  "phonetic": "/.../",
  "partOfSpeech": "verb | noun | adjective | adverb | etc.",
  "definition": "concise, accurate definition",
  "example": "example sentence showing its use",
  "synonyms": ["synonym1", "synonym2", "synonym3"]
}`;

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content: "You are an accurate, concise English dictionary. Always output valid JSON only.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
      }),
      signal: AbortSignal.timeout(7000),
    });

    if (!res.ok) {
      console.error("Groq API responded with status", res.status);
      return null;
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content);
    return {
      word: parsed.word || word,
      phonetic: parsed.phonetic || null,
      audioUrl: null,
      partOfSpeech: parsed.partOfSpeech || "unknown",
      definition: parsed.definition || "No definition found",
      example: parsed.example || null,
      synonyms: Array.isArray(parsed.synonyms) ? parsed.synonyms.slice(0, 5) : [],
      allMeanings: [
        {
          partOfSpeech: parsed.partOfSpeech || "unknown",
          definition: parsed.definition,
          example: parsed.example,
        },
      ],
      found: true,
      source: "groq",
    };
  } catch (err) {
    console.error("Groq dictionary fallback failed:", err);
    return null;
  }
}

// Proxy to Free Dictionary API with Groq AI fallback
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

    // 1. Try Free Dictionary API with a 2.5s timeout
    try {
      const response = await fetch(
        `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
        {
          next: { revalidate: 86400 },
          signal: AbortSignal.timeout(2500),
        }
      );

      if (response.ok) {
        const data = await response.json();
        const entry = Array.isArray(data) ? data[0] : null;

        if (entry) {
          const meanings = entry.meanings || [];
          const firstMeaning = meanings[0] || {};
          const firstDef = firstMeaning.definitions?.[0] || {};

          return NextResponse.json({
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
          });
        }
      }
    } catch (dictErr) {
      console.warn("Free Dictionary API timed out or failed, falling back to Groq...", dictErr);
    }

    // 2. If Free Dictionary API fails, 404s, or times out, try Groq LLM
    const groqResult = await fetchFromGroq(word, context);
    if (groqResult) {
      return NextResponse.json(groqResult);
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
