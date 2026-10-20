import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const word = await prisma.word.findFirst({
      where: { id: params.id, userId: user.id },
    });
    if (!word) {
      return NextResponse.json({ error: "Word not found" }, { status: 404 });
    }
    return NextResponse.json(word);
  } catch (error) {
    console.error("Word GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch word" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const word = await prisma.word.updateMany({
      where: { id: params.id, userId: user.id },
      data: body,
    });
    return NextResponse.json(word);
  } catch (error) {
    console.error("Word PATCH error:", error);
    return NextResponse.json(
      { error: "Failed to update word" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    await prisma.word.deleteMany({
      where: { id: params.id, userId: user.id },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Word DELETE error:", error);
    return NextResponse.json(
      { error: "Failed to delete word" },
      { status: 500 }
    );
  }
}
