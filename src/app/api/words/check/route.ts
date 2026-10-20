import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getLemma, getWordForms } from "@/lib/lemma";

// Check which words from a list already exist in the User's Word Bank (including lemmas/inflections)
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized. Please log in." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { words } = body as { words: string[] };

    if (!words || !Array.isArray(words)) {
      return NextResponse.json(
        { error: "words array is required" },
        { status: 400 }
      );
    }

    const lowerWords = Array.from(
      new Set(words.map((w) => w.toLowerCase().trim()).filter(Boolean))
    );

    if (lowerWords.length === 0) {
      return NextResponse.json({
        known: [],
        knownTexts: [],
        newCount: 0,
        knownCount: 0,
      });
    }

    // Collect all search forms (word + lemma) for each input word
    const searchTokens = new Set<string>();
    const wordToLemmaMap = new Map<string, string>();

    for (const w of lowerWords) {
      const forms = getWordForms(w);
      for (const f of forms) {
        searchTokens.add(f);
      }
      wordToLemmaMap.set(w, getLemma(w));
    }

    const tokenArray = Array.from(searchTokens);

    // Query user's existing bank for any word matching by text OR lemma
    const existing = await prisma.word.findMany({
      where: {
        userId: user.id,
        OR: [
          { text: { in: tokenArray } },
          { lemma: { in: tokenArray } },
        ],
      },
      select: { text: true, lemma: true, status: true },
    });

    const knownExactTexts = new Set<string>();
    const knownLemmas = new Set<string>();

    for (const item of existing) {
      knownExactTexts.add(item.text.toLowerCase());
      if (item.lemma) {
        knownLemmas.add(item.lemma.toLowerCase());
      }
    }

    // Now determine which input words are known
    const matchedKnownWords = new Set<string>();

    for (const word of lowerWords) {
      const lemma = wordToLemmaMap.get(word) || word;
      if (
        knownExactTexts.has(word) ||
        knownLemmas.has(word) ||
        knownExactTexts.has(lemma) ||
        knownLemmas.has(lemma)
      ) {
        matchedKnownWords.add(word);
      }
    }

    const knownTextsArray = Array.from(matchedKnownWords);

    return NextResponse.json({
      known: existing,
      knownTexts: knownTextsArray,
      newCount: lowerWords.length - knownTextsArray.length,
      knownCount: knownTextsArray.length,
    });
  } catch (error) {
    console.error("Words check error:", error);
    return NextResponse.json(
      { error: "Failed to check words" },
      { status: 500 }
    );
  }
}
