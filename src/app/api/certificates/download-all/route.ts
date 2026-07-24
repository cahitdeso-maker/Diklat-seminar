import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { registrations, seminars } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import { generateCertificatePdf } from "@/lib/certificate-pdf";
import { ZipArchive } from "archiver";

/**
 * GET /api/certificates/download-all?seminarId=xxx
 *
 * Generates all certificates for a seminar as individual PDFs and bundles them into a ZIP file.
 * Menggunakan generateCertificatePdf() yang SAMA dengan cetak perorangan,
 * sehingga hasil download IDENTIK dengan cetak.
 * Hanya includes peserta yang sudah present (isPresent = true).
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const seminarId = searchParams.get("seminarId");

    if (!seminarId) {
      return NextResponse.json(
        { error: "seminarId harus diisi" },
        { status: 400 },
      );
    }

    // Get seminar info
    const [seminar] = await db
      .select()
      .from(seminars)
      .where(eq(seminars.id, seminarId))
      .limit(1);

    if (!seminar) {
      return NextResponse.json(
        { error: "Seminar tidak ditemukan" },
        { status: 404 },
      );
    }

    // Get all present participants with certificate data
    const participantList = await db
      .select({
        id: registrations.id,
        fullName: registrations.fullName,
        certificateNumber: registrations.certificateNumber,
      })
      .from(registrations)
      .where(
        and(
          eq(registrations.seminarId, seminarId),
          eq(registrations.isPresent, true),
          eq(registrations.isDeleted, false),
        ),
      )
      .orderBy(registrations.certificateNumber);

    if (participantList.length === 0) {
      return NextResponse.json(
        { error: "Tidak ada peserta yang sudah hadir untuk seminar ini" },
        { status: 404 },
      );
    }

    // Setup ZIP archive
    const archive = new ZipArchive({
      zlib: { level: 6 },
    });

    const chunks: Buffer[] = [];
    archive.on("data", (chunk: Buffer) => chunks.push(chunk));

    let successCount = 0;
    let failCount = 0;

    // Gunakan generateCertificatePdf() yang SAMA dengan cetak perorangan
    // untuk memastikan hasil IDENTIK
    for (const participant of participantList) {
      try {
        const pdfBuffer = await generateCertificatePdf(participant.id, seminarId);

        // Clean filename
        const safeName = participant.fullName
          .replace(/[^a-zA-Z0-9\s]/g, "")
          .replace(/\s+/g, "_")
          .substring(0, 80);

        const certNum = participant.certificateNumber
          ? `${String(participant.certificateNumber).padStart(2, "0")}_`
          : "";

        archive.append(Buffer.from(pdfBuffer), {
          name: `sertifikat_${certNum}${safeName}.pdf`,
        });
        successCount++;
      } catch (error) {
        console.error(
          `Failed to generate certificate for ${participant.fullName}:`,
          error,
        );
        failCount++;
      }
    }

    // Finalize the archive
    archive.finalize();

    // Wait for the archive to finish
    await new Promise<void>((resolve, reject) => {
      archive.on("finish", resolve);
      archive.on("error", reject);
    });

    const zipBuffer = Buffer.concat(chunks);

    // Clean seminar title for filename
    const safeTitle = seminar.title
      .replace(/[^a-zA-Z0-9\s]/g, "")
      .replace(/\s+/g, "_")
      .substring(0, 50);

    return new Response(zipBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="sertifikat_${safeTitle}.zip"`,
        "X-Total-Count": String(participantList.length),
        "X-Success-Count": String(successCount),
        "X-Fail-Count": String(failCount),
      },
    });
  } catch (error) {
    console.error("Download all certificates error:", error);
    return NextResponse.json(
      { error: "Gagal mendownload sertifikat" },
      { status: 500 },
    );
  }
}