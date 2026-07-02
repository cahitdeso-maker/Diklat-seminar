import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import bcrypt from "bcryptjs";

async function verifyPassword(
  password: string,
  storedHash: string,
): Promise<boolean> {
  const sha256Hash = crypto.createHash("sha256").update(password).digest("hex");
  if (sha256Hash === storedHash) return true;
  try {
    return bcrypt.compareSync(password, storedHash);
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email dan password harus diisi" },
        { status: 400 },
      );
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!user || !user.password) {
      return NextResponse.json(
        { error: "Email atau password salah" },
        { status: 401 },
      );
    }

    const valid = await verifyPassword(password, user.password);
    if (!valid) {
      return NextResponse.json(
        { error: "Email atau password salah" },
        { status: 401 },
      );
    }

    // Simple session via cookie - use user's role from database
    const userRole = user.role || "admin";
    const sessionData = Buffer.from(
      JSON.stringify({ userId: user.id, role: userRole }),
    ).toString("base64");

    const response = NextResponse.json({
      success: true,
      role: userRole,
      name: user.fullName,
    });

    response.cookies.set("session", sessionData, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    // Non-httpOnly cookie for client-side auth check
    response.cookies.set("auth_session", sessionData, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan server" },
      { status: 500 },
    );
  }
}
