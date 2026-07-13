import { db } from "./db";
import { certificateNumberSettings, registrations } from "./schema";
import { eq, and, sql, type ExtractTablesWithRelations } from "drizzle-orm";
import type { PgTransaction } from "drizzle-orm/pg-core";
import type { PostgresJsQueryResultHKT } from "drizzle-orm/postgres-js";
import { generateId } from "./utils";

// Type for drizzle transaction (accepts both db and tx)
type TxOrDb = PgTransaction<PostgresJsQueryResultHKT, Record<string, unknown>, ExtractTablesWithRelations<Record<string, unknown>>> | typeof db;

const MONTHS_ROMAN = [
  "I", "II", "III", "IV", "V", "VI",
  "VII", "VIII", "IX", "X", "XI", "XII",
];

export interface CertificateNumberResult {
  number: number;
  code: string;
}

/**
 * Compute nomor sertifikat berikutnya berdasarkan resetOption.
 *
 * @param resetOption - per_tahun | per_seminar | never
 * @param year - tahun (untuk reset per_tahun)
 * @param seminarId - ID seminar (untuk reset per_seminar)
 * @param configNextOverride - optional override dari config row
 * @returns nomor sertifikat berikutnya
 */
async function computeNextCertificateNumber(
  qb: TxOrDb,
  resetOption: string,
  year: string,
  seminarId?: string,
  configNextOverride?: number | null,
): Promise<number> {
  let maxNumber: number | null = null;

  const baseConditions = [
    eq(certificateNumberSettings.isConfig, false),
    eq(certificateNumberSettings.isDeleted, false),
  ];

  if (resetOption === "per_tahun") {
    const result = await qb
      .select({ maxVal: sql<number>`COALESCE(MAX(${certificateNumberSettings.certificateNumber}), 0)` })
      .from(certificateNumberSettings)
      .where(
        and(...baseConditions, eq(certificateNumberSettings.year, year)),
      )
      .limit(1);
    maxNumber = result[0]?.maxVal ?? 0;
  } else if (resetOption === "per_seminar" && seminarId) {
    const result = await qb
      .select({ maxVal: sql<number>`COALESCE(MAX(${certificateNumberSettings.certificateNumber}), 0)` })
      .from(certificateNumberSettings)
      .where(
        and(...baseConditions, eq(certificateNumberSettings.seminarId, seminarId)),
      )
      .limit(1);
    maxNumber = result[0]?.maxVal ?? 0;
  } else {
    // "never" - global max
    const result = await qb
      .select({ maxVal: sql<number>`COALESCE(MAX(${certificateNumberSettings.certificateNumber}), 0)` })
      .from(certificateNumberSettings)
      .where(and(...baseConditions))
      .limit(1);
    maxNumber = result[0]?.maxVal ?? 0;
  }

  const computedNext = maxNumber + 1;

  // Jika ada override dari config, gunakan nilai yang lebih besar
  if (configNextOverride && configNextOverride > 0) {
    return Math.max(configNextOverride, computedNext);
  }

  return computedNext;
}

/**
 * Generate nomor sertifikat untuk seorang peserta.
 * Menyimpan nomor sebagai baris baru di tabel certificate_number_settings (isConfig = false).
 *
 * @param registrationId - ID registrasi peserta
 * @param seminarId - ID seminar
 * @returns CertificateNumberResult dengan nomor dan kode
 */
export async function generateCertificateNumber(
  registrationId: string,
  seminarId: string
): Promise<CertificateNumberResult> {
  // Cek apakah peserta sudah punya nomor
  const [existing] = await db
    .select({
      certificateNumber: registrations.certificateNumber,
      certificateCode: registrations.certificateCode,
    })
    .from(registrations)
    .where(eq(registrations.id, registrationId))
    .limit(1);

  if (!existing) {
    throw new Error("Pendaftaran tidak ditemukan");
  }

  // Jika sudah punya nomor, kembalikan yang sudah ada
  if (existing.certificateNumber !== null && existing.certificateCode) {
    return {
      number: existing.certificateNumber,
      code: existing.certificateCode,
    };
  }

  // Gunakan SQL transaction
  return await db.transaction(async (tx) => {
    // 1. Ambil config row (isConfig = true)
    const [configRow] = await tx
      .select()
      .from(certificateNumberSettings)
      .where(
        and(
          eq(certificateNumberSettings.isConfig, true),
          eq(certificateNumberSettings.isDeleted, false),
        ),
      )
      .limit(1);

    if (!configRow) {
      throw new Error("Pengaturan nomor sertifikat belum dikonfigurasi");
    }

    const monthRoman = MONTHS_ROMAN[new Date().getMonth()];
    const currentYear = String(new Date().getFullYear());
    const effectiveYear = configRow.year || currentYear;

    // 2. Compute next number berdasarkan resetOption (dalam transaksi yang sama)
    const nextNumber = await computeNextCertificateNumber(
      tx,
      configRow.resetOption,
      effectiveYear,
      seminarId,
      configRow.nextCertificateNumber,
    );

    // 3. Generate certificate code sesuai format
    const combinedCode = `${configRow.letterType || "KET"}/${configRow.unitCode || "IV.6.AU"}/${configRow.classification || "A"}`;
    const certFormat = configRow.format || "{nomor}/{kode}/{bulan}/{tahun}";
    let certCode = certFormat
      .replace("{prefix}", "")
      .replace("{letterno}", "")
      .replace("{nomor}", String(nextNumber).padStart(2, "0"))
      .replace("{kode}", combinedCode)
      .replace("{bulan}", monthRoman)
      .replace("{tahun}", effectiveYear)
      .replace("{nama}", "");

    // Clean up leading/trailing special chars
    certCode = certCode.replace(/^[\s\/\-]+|[\s\/\-]+$/g, "");
    const cleanCode = certCode.startsWith("NO : ") ? certCode : `NO : ${certCode}`;

    // 4. INSERT baris baru ke certificate_number_settings (isConfig = false)
    await tx.insert(certificateNumberSettings).values({
      id: generateId(),
      certificateNumber: nextNumber,
      certificateCode: cleanCode,
      registrationId: registrationId,
      seminarId: seminarId,
      monthRoman: monthRoman,
      isConfig: false,
      letterPrefix: configRow.letterPrefix,
      institutionCode: configRow.institutionCode,
      letterType: configRow.letterType,
      unitCode: configRow.unitCode,
      classification: configRow.classification,
      year: effectiveYear,
      format: configRow.format,
      participantName: configRow.participantName,
      resetOption: configRow.resetOption,
      isDeleted: false,
    });

    // 5. Simpan nomor ke registrasi peserta
    await tx
      .update(registrations)
      .set({
        certificateNumber: nextNumber,
        certificateCode: cleanCode,
        certificateGeneratedAt: new Date(),
      })
      .where(eq(registrations.id, registrationId));

    return {
      number: nextNumber,
      code: cleanCode,
    };
  });
}

/**
 * Validasi apakah nomor sertifikat sudah digunakan dalam seminar yang sama.
 */
export async function validateCertificateNumber(
  seminarId: string,
  certificateNumber: number,
  excludeRegistrationId?: string
): Promise<{ available: boolean; message?: string }> {
  const conditions = [
    eq(registrations.seminarId, seminarId),
    eq(registrations.certificateNumber, certificateNumber),
    eq(registrations.isDeleted, false),
  ];

  if (excludeRegistrationId) {
    const { ne } = await import("drizzle-orm");
    conditions.push(ne(registrations.id, excludeRegistrationId));
  }

  const [existing] = await db
    .select({ id: registrations.id })
    .from(registrations)
    .where(and(...conditions))
    .limit(1);

  if (existing) {
    return {
      available: false,
      message: `Nomor sertifikat ${String(certificateNumber).padStart(3, "0")} sudah digunakan oleh peserta lain.`,
    };
  }

  return { available: true };
}

/**
 * Update nomor sertifikat secara manual oleh admin.
 * Menyimpan nomor sebagai baris baru di certificate_number_settings (isConfig = false).
 */
export async function updateCertificateNumber(
  registrationId: string,
  seminarId: string,
  newNumber: number
): Promise<CertificateNumberResult> {
  // Validasi nomor belum digunakan
  const validation = await validateCertificateNumber(seminarId, newNumber, registrationId);
  if (!validation.available) {
    throw new Error(validation.message || "Nomor sertifikat sudah digunakan.");
  }

  // Ambil config row untuk format settings
  const [configRow] = await db
    .select()
    .from(certificateNumberSettings)
    .where(
      and(
        eq(certificateNumberSettings.isConfig, true),
        eq(certificateNumberSettings.isDeleted, false),
      ),
    )
    .limit(1);

  if (!configRow) {
    throw new Error("Pengaturan nomor sertifikat belum dikonfigurasi");
  }

  const monthRoman = MONTHS_ROMAN[new Date().getMonth()];
  const effectiveYear = configRow.year || String(new Date().getFullYear());

  // Generate certificate code sesuai format
  const combinedCode = `${configRow.letterType || "KET"}/${configRow.unitCode || "IV.6.AU"}/${configRow.classification || "A"}`;
  let certCode = (configRow.format || "{nomor}/{kode}/{bulan}/{tahun}")
    .replace("{prefix}", "")
    .replace("{letterno}", "")
    .replace("{nomor}", String(newNumber).padStart(2, "0"))
    .replace("{kode}", combinedCode)
    .replace("{bulan}", monthRoman)
    .replace("{tahun}", effectiveYear)
    .replace("{nama}", "");

  certCode = certCode.replace(/^[\s\/\-]+|[\s\/\-]+$/g, "");
  const cleanCode = certCode.startsWith("NO : ") ? certCode : `NO : ${certCode}`;

  // INSERT baris baru ke certificate_number_settings (isConfig = false)
  await db.insert(certificateNumberSettings).values({
    id: generateId(),
    certificateNumber: newNumber,
    certificateCode: cleanCode,
    registrationId: registrationId,
    seminarId: seminarId,
    monthRoman: monthRoman,
    isConfig: false,
    letterPrefix: configRow.letterPrefix,
    institutionCode: configRow.institutionCode,
    letterType: configRow.letterType,
    unitCode: configRow.unitCode,
    classification: configRow.classification,
    year: effectiveYear,
    format: configRow.format,
    participantName: configRow.participantName,
    resetOption: configRow.resetOption,
    isDeleted: false,
  });

  // Update registrasi peserta
  await db
    .update(registrations)
    .set({
      certificateNumber: newNumber,
      certificateCode: cleanCode,
      certificateGeneratedAt: new Date(),
    })
    .where(eq(registrations.id, registrationId));

  return {
    number: newNumber,
    code: cleanCode,
  };
}

/**
 * Reset penomoran: cukup update config row's nextCertificateNumber override.
 * Nomor berikutnya akan dihitung dari MAX(certificate_number) + override.
 */
export async function resetCertificateNumber(
  settingsId: string,
  resetOption: "per_seminar" | "per_tahun" | "never"
): Promise<void> {
  if (resetOption === "never") return;

  // Reset override di config row agar perhitungan dimulai dari 1
  await db
    .update(certificateNumberSettings)
    .set({
      nextCertificateNumber: 1,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(certificateNumberSettings.id, settingsId),
        eq(certificateNumberSettings.isConfig, true),
      ),
    );
}
