import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { certificateNumberSettings } from "@/lib/schema";
import { eq, and, sql } from "drizzle-orm";

const MONTHS_ROMAN = [
  "I", "II", "III", "IV", "V", "VI",
  "VII", "VIII", "IX", "X", "XI", "XII",
];

// GET /api/certificate-settings - Ambil pengaturan nomor surat
export async function GET() {
  try {
    // Cari config row (isConfig = true)
    let [config] = await db
      .select()
      .from(certificateNumberSettings)
      .where(
        and(
          eq(certificateNumberSettings.isConfig, true),
          eq(certificateNumberSettings.isDeleted, false),
        ),
      )
      .limit(1);

    // Jika belum ada config row, buat default
    if (!config) {
      const currentYear = String(new Date().getFullYear());
      const newRow = {
        isConfig: true,
        letterPrefix: "NO : ",
        institutionCode: "RSUD",
        letterType: "KET",
        unitCode: "IV.6.AU",
        classification: "A",
        year: currentYear,
        format: "{nomor}/{kode}/{bulan}/{tahun}",
        participantName: "",
        nextCertificateNumber: 1,
        resetOption: "per_tahun" as const,
        isDeleted: false,
      };
      const [inserted] = await db
        .insert(certificateNumberSettings)
        .values(newRow)
        .returning();
      config = inserted;
    }

    // Hitung nomor terakhir dari log (isConfig = false)
    const [lastResult] = await db
      .select({ maxVal: sql<number>`COALESCE(MAX(${certificateNumberSettings.certificateNumber}), 0)` })
      .from(certificateNumberSettings)
      .where(
        and(
          eq(certificateNumberSettings.isConfig, false),
          eq(certificateNumberSettings.isDeleted, false),
        ),
      )
      .limit(1);

    const lastCertificateNumber = lastResult?.maxVal ?? 0;

    // Hitung next number berdasarkan resetOption
    let nextNumber = 0;
    if (config.resetOption === "per_tahun") {
      const [res] = await db
        .select({ maxVal: sql<number>`COALESCE(MAX(${certificateNumberSettings.certificateNumber}), 0)` })
        .from(certificateNumberSettings)
        .where(
          and(
            eq(certificateNumberSettings.isConfig, false),
            eq(certificateNumberSettings.isDeleted, false),
            eq(certificateNumberSettings.year, config.year),
          ),
        )
        .limit(1);
      nextNumber = Math.max(res?.maxVal ?? 0, (config.nextCertificateNumber || 1) - 1) + 1;
    } else if (config.resetOption === "never") {
      nextNumber = Math.max(lastCertificateNumber, (config.nextCertificateNumber || 1) - 1) + 1;
    } else {
      // per_seminar - default to global
      nextNumber = Math.max(lastCertificateNumber, (config.nextCertificateNumber || 1) - 1) + 1;
    }

    // Kirim data config + computed values
    return NextResponse.json({
      ...config,
      nextCertificateNumber: nextNumber,
      lastCertificateNumber: lastCertificateNumber,
      currentNumber: 0, // backward compatibility
    });
  } catch (error) {
    console.error("Get certificate settings error:", error);
    return NextResponse.json(
      { error: "Gagal memuat pengaturan nomor surat" },
      { status: 500 },
    );
  }
}

// PUT /api/certificate-settings - Update pengaturan nomor sertifikat
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const {
      letterType,
      unitCode,
      classification,
      format,
      year,
      nextCertificateNumber,
      resetOption,
    } = body;

    // Cari config row yang sudah ada
    const [existing] = await db
      .select()
      .from(certificateNumberSettings)
      .where(
        and(
          eq(certificateNumberSettings.isConfig, true),
          eq(certificateNumberSettings.isDeleted, false),
        ),
      )
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { error: "Pengaturan nomor sertifikat tidak ditemukan" },
        { status: 404 },
      );
    }

    const updateData: Record<string, unknown> = {};

    if (letterType !== undefined) {
      updateData.letterType = letterType;
      updateData.institutionCode = `${letterType}/${(unitCode || existing.unitCode)}/${(classification || existing.classification)}`;
    }
    if (unitCode !== undefined) {
      updateData.unitCode = unitCode;
      updateData.institutionCode = `${(letterType || existing.letterType)}/${unitCode}/${(classification || existing.classification)}`;
    }
    if (classification !== undefined) {
      updateData.classification = classification;
      updateData.institutionCode = `${(letterType || existing.letterType)}/${(unitCode || existing.unitCode)}/${classification}`;
    }
    if (format !== undefined) updateData.format = format;
    if (year !== undefined) updateData.year = year;
    if (nextCertificateNumber !== undefined) updateData.nextCertificateNumber = nextCertificateNumber;
    if (resetOption !== undefined) updateData.resetOption = resetOption;
    updateData.updatedAt = new Date();

    await db
      .update(certificateNumberSettings)
      .set(updateData)
      .where(eq(certificateNumberSettings.id, existing.id));

    // Ambil data terbaru
    const [updated] = await db
      .select()
      .from(certificateNumberSettings)
      .where(eq(certificateNumberSettings.id, existing.id))
      .limit(1);

    // Hitung last dan next number
    const [lastResult] = await db
      .select({ maxVal: sql<number>`COALESCE(MAX(${certificateNumberSettings.certificateNumber}), 0)` })
      .from(certificateNumberSettings)
      .where(
        and(
          eq(certificateNumberSettings.isConfig, false),
          eq(certificateNumberSettings.isDeleted, false),
        ),
      )
      .limit(1);

    const lastCertificateNumber = lastResult?.maxVal ?? 0;

    let nextNumber = 0;
    if (updated.resetOption === "per_tahun") {
      const [res] = await db
        .select({ maxVal: sql<number>`COALESCE(MAX(${certificateNumberSettings.certificateNumber}), 0)` })
        .from(certificateNumberSettings)
        .where(
          and(
            eq(certificateNumberSettings.isConfig, false),
            eq(certificateNumberSettings.isDeleted, false),
            eq(certificateNumberSettings.year, updated.year),
          ),
        )
        .limit(1);
      nextNumber = Math.max(res?.maxVal ?? 0, (updated.nextCertificateNumber || 1) - 1) + 1;
    } else {
      nextNumber = Math.max(lastCertificateNumber, (updated.nextCertificateNumber || 1) - 1) + 1;
    }

    return NextResponse.json({
      ...updated,
      nextCertificateNumber: nextNumber,
      lastCertificateNumber: lastCertificateNumber,
      currentNumber: 0,
    });
  } catch (error) {
    console.error("Update certificate settings error:", error);
    return NextResponse.json(
      { error: "Gagal mengupdate pengaturan nomor sertifikat" },
      { status: 500 },
    );
  }
}
