import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized. Please log in." },
        { status: 401 }
      );
    }

    const transcript = await prisma.transcriptUpload.findFirst({
      where: {
        id: params.id,
        userId: user.id,
      },
      include: {
        progress: {
          where: { userId: user.id },
        },
      },
    });

    if (!transcript) {
      return NextResponse.json(
        { error: "Transcript not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ...transcript,
      reviewProgress: transcript.progress[0] || null,
    });
  } catch (error) {
    console.error("Transcript GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch transcript" },
      { status: 500 }
    );
  }
}
