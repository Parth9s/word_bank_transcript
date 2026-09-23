import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const transcripts = await prisma.transcriptUpload.findMany({
      orderBy: { uploadedAt: "desc" },
      select: {
        id: true,
        title: true,
        uploadedAt: true,
        wordCount: true,
        uniqueWordCount: true,
      },
    });

    return NextResponse.json(transcripts);
  } catch (error) {
    console.error("Transcripts GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch transcripts" },
      { status: 500 }
    );
  }
}
