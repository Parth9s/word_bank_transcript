import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseTranscript, type TranscriptFormat } from "@/lib/parser";
import { getCurrentUser } from "@/lib/auth";

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
    const { title, rawText, format } = body as {
      title: string;
      rawText: string;
      format?: TranscriptFormat;
    };

    if (!rawText || !rawText.trim()) {
      return NextResponse.json(
        { error: "No text provided" },
        { status: 400 }
      );
    }

    const parsed = parseTranscript(rawText, format);

    const upload = await prisma.transcriptUpload.create({
      data: {
        userId: user.id,
        title: title || "Untitled Transcript",
        rawText,
        parsedData: JSON.parse(
          JSON.stringify({
            frequencyMap: parsed.frequencyMap,
            categories: parsed.categories,
            wordContexts: parsed.wordContexts,
            cleanedText: parsed.cleanedText,
          })
        ),
        wordCount: parsed.totalWordCount,
        uniqueWordCount: parsed.uniqueWordCount,
      },
    });

    return NextResponse.json({
      id: upload.id,
      title: upload.title,
      wordCount: parsed.totalWordCount,
      uniqueWordCount: parsed.uniqueWordCount,
      frequencyMap: parsed.frequencyMap,
      categories: parsed.categories,
      wordContexts: parsed.wordContexts,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Failed to process transcript" },
      { status: 500 }
    );
  }
}
