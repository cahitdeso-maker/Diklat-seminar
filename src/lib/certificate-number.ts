import { db } from "./db";
import { certificateNumberSettings, registrations } from "./schema";
import { eq, and, ne, sql, type ExtractTablesWithRelations } from "drizzle-orm";
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
 */
async function computeNextCertificateNumber(
  qb: TxOrDb,
  resetOption: string,
  year: string,
  seminarId?: string,
  configNextOverride?: number | null,
): Promise<number> {
  const baseConditions = [
    eq(certificateNumberSettings.isConfig, false),
    eq(certificateNumberSettings.isDeleted, false),
  ];

  if (configNextOverride && configNextOverride > 1000000) {
    return configNextOverride;
  }

  let maxNumber: number;

  if (resetOption === "per_tahun") {
    const result = await qb
      .select({ maxVal: sql<number>`COALESCE(MAX(${certificateNumberSettings.certificateNumber}), 0)` })
      .from(certificateNumberSettings)
      .where(and(...baseConditions, eq(certificateNumberSettings.year, year)));
    maxNumber = result[0]?.maxVal ?? 0;
  } else if (resetOption === "per_seminar" && seminarId) {
    const result = await qb
      .select({ maxVal: sql<number>`COALESCE(MAX(${certificateNumberSettings.certificateNumber}), 0)` })
      .from(certificateNumberSettings)
      .where(and(...baseConditions, eq(certificateNumberSettings.seminarId, seminarId)));
    maxNumber = result[0]?.maxVal ?? 0;
  } else {
    const result = await qb
      .select({ maxVal: sql<number>`COALESCE(MAX(${certificateNumberSettings.certificateNumber}), 0)` })
      .from(certificateNumberSettings)
      .where(and(...baseConditions));
    maxNumber = result[0]?.maxVal ?? 0;
  }

  const computedNext = maxNumber + 1;

  if (configNextOverride && configNextOverride > 0) {
    return Math.max(configNextOverride, computedNext);
  }

  return computedNext;
}

/**
 * Generate certificate code, INSERT log, dan UPDATE registrasi.
 * Hanya ditulis SEKALI, dipakai oleh generateCertificateNumber dan updateCertificateNumber.
 */
async function insertAndUpdateCertificate(
  tx: Parameters<typeof db.transaction>[0] extends (fn: infer F) => any ? F : never,
  configRow: typeof certificateNumberSettings.$inferSelect,
  registrationId: string,
  seminarId: string,
  number: number,
  participantName: string,
): Promise<CertificateNumberResult> {
  const monthRoman = configRow.monthRoman || MONTHS_ROMAN[new Date().getMonth()];
  const currentYear = String(new Date().getFullYear());
  const effectiveYear = configRow.year || currentYear;

  const combinedCode = `${configRow.letterType || "KET"}/${configRow.unitCode || "IV.6.AU"}/${configRow.classification || "A"}`;
  const certFormat = configRow.format || "{nomor}/{kode}/{bulan}/{tahun}";
  let certCode = certFormat
    .replace("{prefix}", "")
    .replace("{letterno}", "")
    .replace("{nomor}", String(number).padStart(2, "0"))
    .replace("{kode}", combinedCode)
    .replace("{bulan}", monthRoman)
    .replace("{tahun}", effectiveYear)
    .replace("{nama}", "");
  certCode = certCode.replace(/^[\s\/\-]+|[\s\/\-]+$/g, "");
  const cleanCode = certCode.startsWith("NO : ") ? certCode : `NO : ${certCode}`;

  await tx.insert(certificateNumberSettings).values({
    id: generateId(),
    certificateNumber: number,
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
    participantName: participantName,
    resetOption: configRow.resetOption,
    isDeleted: false,
  });

  await tx
    .update(registrations)
    .set({
      certificateNumber: number,
      certificateCode: cleanCode,
      certificateGeneratedAt: new Date(),
    })
    .where(eq(registrations.id, registrationId));

  return {
    number: number,
    code: cleanCode,
  };
}

/**
 * Generate nomor sertifikat untuk seorang peserta.
 */
export async function generateCertificateNumber(
  registrationId: string,
  seminarId: string
): Promise<CertificateNumberResult> {
  return await db.transaction(async (tx) => {
    const [configRow] = await tx
      .select()
      .from(certificateNumberSettings)
      .where(
        and(
          eq(certificateNumberSettings.isConfig, true),
          eq(certificateNumberSettings.isDeleted, false),
        ),
      )
      .limit(1)
      .for("update");

    if (!configRow) {
      throw new Error("Pengaturan nomor sertifikat belum dikonfigurasi");
    }

    const [existing] = await tx
      .select({
        certificateNumber: registrations.certificateNumber,
        certificateCode: registrations.certificateCode,
        fullName: registrations.fullName,
      })
      .from(registrations)
      .where(eq(registrations.id, registrationId))
      .limit(1);

    if (!existing) {
      throw new Error("Pendaftaran tidak ditemukan");
    }

    if (existing.certificateNumber !== null && existing.certificateCode) {
      return {
        number: existing.certificateNumber,
        code: existing.certificateCode,
      };
    }

    const effectiveYear = configRow.year || String(new Date().getFullYear());

    const nextNumber = await computeNextCertificateNumber(
      tx,
      configRow.resetOption,
      effectiveYear,
      seminarId,
      configRow.nextCertificateNumber,
    );

    return await insertAndUpdateCertificate(
      tx,
      configRow,
      registrationId,
      seminarId,
      nextNumber,
      existing.fullName || "",
    );
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
 */
export async function updateCertificateNumber(
  registrationId: string,
  seminarId: string,
  newNumber: number
): Promise<CertificateNumberResult> {
  const validation = await validateCertificateNumber(seminarId, newNumber, registrationId);
  if (!validation.available) {
    throw new Error(validation.message || "Nomor sertifikat sudah digunakan.");
  }

  return await db.transaction(async (tx) => {
    const [configRow] = await tx
      .select()
      .from(certificateNumberSettings)
      .where(
        and(
          eq(certificateNumberSettings.isConfig, true),
          eq(certificateNumberSettings.isDeleted, false),
        ),
      )
      .limit(1)
      .for("update");

    if (!configRow) {
      throw new Error("Pengaturan nomor sertifikat belum dikonfigurasi");
    }

    const [regData] = await tx
      .select({ fullName: registrations.fullName })
      .from(registrations)
      .where(eq(registrations.id, registrationId))
      .limit(1);

    if (!regData) {
      throw new Error("Pendaftaran tidak ditemukan");
    }

    return await insertAndUpdateCertificate(
      tx,
      configRow,
      registrationId,
      seminarId,
      newNumber,
      regData.fullName || "",
    );
  });
}

/**
 * Ambil nomor sertifikat terbesar yang pernah dikeluarkan dari log
 * (isConfig = false). Opsional difilter per tahun untuk kasus reset per_tahun.
 * Dipakai oleh certificate-settings dan fungsi-fungsi di file ini.
 */
export async function getLastCertificateNumber(
  year?: string,
): Promise<number> {
  const conditions = [
    eq(certificateNumberSettings.isConfig, false),
    eq(certificateNumberSettings.isDeleted, false),
  ];

  if (year != null && year !== "") {
    conditions.push(eq(certificateNumberSettings.year, year));
  }

  const [result] = await db
    .select({
      maxVal: sql<number>`COALESCE(MAX(${certificateNumberSettings.certificateNumber}), 0)`,
    })
    .from(certificateNumberSettings)
    .where(and(...conditions));

  return result?.maxVal ?? 0;
}

/**
 * Reset penomoran: cukup update config row's nextCertificateNumber override.
 */
export async function resetCertificateNumber(
  settingsId: string,
  resetOption: "per_seminar" | "per_tahun" | "never"
): Promise<void> {
  if (resetOption === "never") return;

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