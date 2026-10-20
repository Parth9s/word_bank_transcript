import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  verifyPassword,
  hashPassword,
  createSessionToken,
  COOKIE_NAME,
} from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, setInitialPassword } = body as {
      email?: string;
      password?: string;
      setInitialPassword?: string;
    };

    if (!email || !email.trim()) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    const cleanEmail = email.toLowerCase().trim();
    const user = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    if (!user) {
      return NextResponse.json(
        { error: "No account found with this email. Please sign up." },
        { status: 404 }
      );
    }

    // Check if user has no password set (like first-time login for migrated account)
    if (!user.passwordHash) {
      const passwordToSet = setInitialPassword || password;
      if (!passwordToSet || passwordToSet.length < 6) {
        return NextResponse.json({
          needsPasswordSetup: true,
          message:
            "Welcome! As this is your first time logging in, please set a password (min 6 characters).",
        });
      }

      // Set password
      const newHash = await hashPassword(passwordToSet);
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: newHash },
      });

      const token = await createSessionToken({
        userId: user.id,
        email: user.email,
        name: user.name,
      });

      const res = NextResponse.json({
        success: true,
        user: { id: user.id, email: user.email, name: user.name },
        message: "Password set and logged in successfully!",
      });

      res.cookies.set(COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 30 * 24 * 60 * 60, // 30 days
      });

      return res;
    }

    // Existing password verification
    if (!password) {
      return NextResponse.json(
        { error: "Password is required" },
        { status: 400 }
      );
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid password" },
        { status: 401 }
      );
    }

    const token = await createSessionToken({
      userId: user.id,
      email: user.email,
      name: user.name,
    });

    const res = NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email, name: user.name },
    });

    res.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
    });

    return res;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Failed to log in" },
      { status: 500 }
    );
  }
}
