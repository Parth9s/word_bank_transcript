import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized. Please log in." },
        { status: 401 }
      );
    }

    const transcripts = await prisma.transcriptUpload.findMany({
      where: {
        userId: user.id,
      },
      orderBy: { uploadedAt: "desc" },
      select: {
        id: true,
        title: true,
        uploadedAt: true,
        wordCount: true,
        uniqueWordCount: true,
        progress: {
          where: { userId: user.id },
          select: {
            currentIndex: true,
            completed: true,
            updatedAt: true,
          },
        },
      },
    });

    const formatted = transcripts.map((t) => ({
      ...t,
      reviewProgress: t.progress[0] || null,
    }));

    return NextResponse.json(formatted);
  } catch (error) {
    console.error("Transcripts GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch transcripts" },
      { status: 500 }
    );
  }
}
