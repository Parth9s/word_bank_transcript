import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Check which words from a list already exist in the Word Bank
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { words } = body as { words: string[] };

    if (!words || !Array.isArray(words)) {
      return NextResponse.json(
        { error: "words array is required" },
        { status: 400 }
      );
    }

    const lowerWords = words.map((w) => w.toLowerCase());

    const existing = await prisma.word.findMany({
      where: { text: { in: lowerWords } },
      select: { text: true, status: true },
    });

    const knownSet = new Set(existing.map((w) => w.text));

    return NextResponse.json({
      known: existing,
      knownTexts: Array.from(knownSet),
      newCount: lowerWords.length - knownSet.size,
      knownCount: knownSet.size,
    });
  } catch (error) {
    console.error("Words check error:", error);
    return NextResponse.json(
      { error: "Failed to check words" },
      { status: 500 }
    );
  }
}
