import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { certificateNumberSettings } from "@/lib/schema";
import { eq } from "drizzle-orm";

// GET /api/certificate-settings - Ambil pengaturan nomor surat
export async function GET() {
  try {
    const [settings] = await db
      .select()
      .from(certificateNumberSettings)
      .where(eq(certificateNumberSettings.isDeleted, false))
      .limit(1);

    if (!settings) {
      return NextResponse.json(
        { error: "Pengaturan nomor surat tidak ditemukan" },
        { status: 404 },
      );
    }

    return NextResponse.json(settings);
  } catch (error) {
    console.error("Get certificate settings error:", error);
    return NextResponse.json(
      { error: "Gagal memuat pengaturan nomor surat" },
      { status: 500 },
    );
  }
}

// PUT /api/certificate-settings - Update pengaturan nomor surat
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const {
      letterPrefix,
      letterNo,
      institutionCode,
      currentNumber,
      year,
      format,
    } = body;

    const [existing] = await db
      .select()
      .from(certificateNumberSettings)
      .where(eq(certificateNumberSettings.isDeleted, false))
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { error: "Pengaturan nomor surat tidak ditemukan" },
        { status: 404 },
      );
    }

    await db
      .update(certificateNumberSettings)
      .set({
        letterPrefix: letterPrefix ?? existing.letterPrefix,
        letterNo: letterNo !== undefined ? letterNo : existing.letterNo,
        institutionCode: institutionCode ?? existing.institutionCode,
        currentNumber:
          currentNumber !== undefined ? currentNumber : existing.currentNumber,
        year: year ?? existing.year,
        format: format ?? existing.format,
        updatedAt: new Date(),
      })
      .where(eq(certificateNumberSettings.id, existing.id));

    const [updated] = await db
      .select()
      .from(certificateNumberSettings)
      .where(eq(certificateNumberSettings.id, existing.id))
      .limit(1);

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Update certificate settings error:", error);
    return NextResponse.json(
      { error: "Gagal mengupdate pengaturan nomor surat" },
      { status: 500 },
    );
  }
}
