import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const sort = searchParams.get("sort") || "addedAt";

    const where: Record<string, unknown> = {};
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

    // Upsert — if word already exists, update its status
    const word = await prisma.word.upsert({
      where: { text: text.toLowerCase() },
      update: {
        status,
        ...(definitionData && { definitionData: definitionData as object }),
        ...(firstSeenContext && { firstSeenContext }),
      },
      create: {
        text: text.toLowerCase(),
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
