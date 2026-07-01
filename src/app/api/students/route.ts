import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { generateId } from "@/lib/utils";
import { eq } from "drizzle-orm";

export async function POST(request: Request) {
  try {
    const { fullName, schoolOrigin, age, address } = await request.json();

    if (!fullName) {
      return NextResponse.json(
        { error: "Nama lengkap harus diisi" },
        { status: 400 },
      );
    }

    const id = generateId();
    await db.insert(users).values({
      id,
      fullName,
      schoolOrigin: schoolOrigin || null,
      age: age ? parseInt(age) : null,
      address: address || null,
      role: "mahasiswa",
    });

    return NextResponse.json({
      success: true,
      message: "Registrasi berhasil! Silakan tunggu persetujuan Admin.",
      studentId: id,
    });
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan saat registrasi" },
      { status: 500 },
    );
  }
}

export async function GET() {
  try {
    const allStudents = await db
      .select()
      .from(users)
      .where(eq(users.role, "mahasiswa"));

    return NextResponse.json(allStudents);
  } catch (error) {
    console.error("Get students error:", error);
    return NextResponse.json(
      { error: "Gagal mengambil data mahasiswa" },
      { status: 500 },
    );
  }
}
