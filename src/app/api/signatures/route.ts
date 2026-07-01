import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { signatureSettings } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";

// GET /api/signatures - Ambil semua penanda tangan
export async function GET() {
  try {
    const data = await db
      .select()
      .from(signatureSettings)
      .where(eq(signatureSettings.isDeleted, false))
      .orderBy(signatureSettings.createdAt);

    return NextResponse.json(data);
  } catch (error) {
    console.error("Get signatures error:", error);
    return NextResponse.json(
      { error: "Gagal memuat data penanda tangan" },
      { status: 500 },
    );
  }
}

// POST /api/signatures - Tambah penanda tangan baru
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, position, nip, signatureImage, isActive } = body;

    if (!name || !position) {
      return NextResponse.json(
        { error: "Nama dan jabatan harus diisi" },
        { status: 400 },
      );
    }

    const id = crypto.randomUUID();

    await db.insert(signatureSettings).values({
      id,
      name,
      position,
      nip: nip || null,
      signatureImage: signatureImage || null,
      isActive: isActive || false,
    });

    const [created] = await db
      .select()
      .from(signatureSettings)
      .where(eq(signatureSettings.id, id))
      .limit(1);

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("Create signature error:", error);
    return NextResponse.json(
      { error: "Gagal menambah penanda tangan" },
      { status: 500 },
    );
  }
}
