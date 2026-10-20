import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getLemma } from "@/lib/lemma";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized. Please log in." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const sort = searchParams.get("sort") || "addedAt";

    const where: Record<string, unknown> = {
      userId: user.id,
    };

    if (search) {
      where.text = { contains: search, mode: "insensitive" };
    }
    if (status && status !== "all") {
      where.status = status;
    }

    type SortOrder = "asc" | "desc";
    let orderBy: Record<string, SortOrder> = { addedAt: "desc" };
    if (sort === "alphabetical") orderBy = { text: "asc" };
    if (sort === "frequency") orderBy = { frequency: "desc" };
    if (sort === "recent") orderBy = { addedAt: "desc" };

    const words = await prisma.word.findMany({
      where,
      orderBy,
    });

    return NextResponse.json(words);
  } catch (error) {
    console.error("Words GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch words" },
      { status: 500 }
    );
  }
}

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
    const { text, status, definitionData, firstSeenContext, frequency } =
      body as {
        text: string;
        status: string;
        definitionData?: unknown;
        firstSeenContext?: string;
        frequency?: number;
      };

    if (!text) {
      return NextResponse.json(
        { error: "Word text is required" },
        { status: 400 }
      );
    }

    const cleanText = text.toLowerCase().trim();
    const lemma = getLemma(cleanText);

    // Upsert — per-user unique constraint
    const word = await prisma.word.upsert({
      where: {
        userId_text: {
          userId: user.id,
          text: cleanText,
        },
      },
      update: {
        status,
        lemma,
        ...(definitionData ? { definitionData: definitionData as object } : {}),
        ...(firstSeenContext ? { firstSeenContext } : {}),
        ...(typeof frequency === "number" ? { frequency } : {}),
      },
      create: {
        userId: user.id,
        text: cleanText,
        lemma,
        status,
        definitionData: (definitionData as object) || undefined,
        firstSeenContext,
        frequency,
      },
    });

    return NextResponse.json(word);
  } catch (error) {
    console.error("Words POST error:", error);
    return NextResponse.json(
      { error: "Failed to save word" },
      { status: 500 }
    );
  }
}
