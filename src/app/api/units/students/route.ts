import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  try {
    // Get all students grouped by unit
    const allStudents = await db
      .select()
      .from(users)
      .where(eq(users.role, "mahasiswa"));

    // Group by unitId
    const grouped: Record<string, typeof allStudents> = {};
    for (const student of allStudents) {
      const unitId = student.unitId || "unassigned";
      if (!grouped[unitId]) grouped[unitId] = [];
      grouped[unitId].push(student);
    }

    return NextResponse.json(grouped);
  } catch (error) {
    console.error("Get students by unit error:", error);
    return NextResponse.json(
      { error: "Gagal mengambil data mahasiswa" },
      { status: 500 },
    );
  }
}
