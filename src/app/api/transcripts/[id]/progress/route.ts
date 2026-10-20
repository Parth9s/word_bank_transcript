import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function POST(
  req: NextRequest,
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

    const body = await req.json();
    const { currentIndex, completed } = body as {
      currentIndex: number;
      completed?: boolean;
    };

    if (typeof currentIndex !== "number") {
      return NextResponse.json(
        { error: "currentIndex number is required" },
        { status: 400 }
      );
    }

    const progress = await prisma.reviewProgress.upsert({
      where: {
        userId_transcriptId: {
          userId: user.id,
          transcriptId: params.id,
        },
      },
      update: {
        currentIndex,
        ...(typeof completed === "boolean" ? { completed } : {}),
      },
      create: {
        userId: user.id,
        transcriptId: params.id,
        currentIndex,
        completed: Boolean(completed),
      },
    });

    return NextResponse.json(progress);
  } catch (error) {
    console.error("Progress save error:", error);
    return NextResponse.json(
      { error: "Failed to save progress" },
      { status: 500 }
    );
  }
}
