import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { eq } from "drizzle-orm";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const updateData: Record<string, unknown> = {};

    if (body.unitId !== undefined) updateData.unitId = body.unitId;
    if (body.faceData !== undefined) updateData.faceData = body.faceData;

    await db.update(users).set(updateData).where(eq(users.id, id));

    return NextResponse.json({
      success: true,
      message: "Data mahasiswa berhasil diperbarui",
    });
  } catch (error) {
    console.error("Update student error:", error);
    return NextResponse.json(
      { error: "Gagal memperbarui data mahasiswa" },
      { status: 500 },
    );
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const [student] = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (!student) {
      return NextResponse.json(
        { error: "Mahasiswa tidak ditemukan" },
        { status: 404 },
      );
    }

    return NextResponse.json(student);
  } catch (error) {
    console.error("Get student error:", error);
    return NextResponse.json(
      { error: "Gagal mengambil data mahasiswa" },
      { status: 500 },
    );
  }
}
