import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Proxy to Free Dictionary API to avoid CORS issues and cache results
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const word = searchParams.get("word");

    if (!word) {
      return NextResponse.json(
        { error: "word parameter is required" },
        { status: 400 }
      );
    }

    const response = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
      { next: { revalidate: 86400 } } // Cache for 24 hours
    );

    if (!response.ok) {
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
    }

    const data = await response.json();
    const entry = Array.isArray(data) ? data[0] : null;

    if (!entry) {
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
    }

    // Extract the most useful information
    const meanings = entry.meanings || [];
    const firstMeaning = meanings[0] || {};
    const firstDef = firstMeaning.definitions?.[0] || {};

    const result = {
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
    };

    return NextResponse.json(result);
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
