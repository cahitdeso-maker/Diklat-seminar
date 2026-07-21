import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { registrations, seminars } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import { getCertificateHtml, inlineCertificateImages } from "@/lib/certificate-pdf";
import { ZipArchive } from "archiver";

/**
 * GET /api/certificates/download-all?seminarId=xxx
 *
 * Generates all certificates for a seminar as individual PDFs and bundles them into a ZIP file.
 * Only includes participants who are present (isPresent = true).
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
        certificateCode: registrations.certificateCode,
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

    // Set up archiver for ZIP output
    const archive = new ZipArchive({
      zlib: { level: 6 },
    });

    // Create a transform stream to capture the ZIP buffer
    const chunks: Buffer[] = [];
    archive.on("data", (chunk: Buffer) => chunks.push(chunk));

    // Track progress for the response
    let successCount = 0;
    let failCount = 0;

    // Generate each participant's certificate HTML and add to ZIP
    for (const participant of participantList) {
      try {
        const html = await getCertificateHtml(
          participant.id,
          seminarId,
          false,
        );

        // Inline images as base64 data URIs for self-contained HTML
        const htmlWithInlineImages = inlineCertificateImages(html);

        // Clean filename: remove special chars, limit length
        const safeName = participant.fullName
          .replace(/[^a-zA-Z0-9\s]/g, "")
          .replace(/\s+/g, "_")
          .substring(0, 80);

        const certNum = participant.certificateNumber
          ? `${String(participant.certificateNumber).padStart(2, "0")}_`
          : "";

        // Simpan sebagai HTML dengan print CSS (bisa dibuka dan di-print ke PDF)
        archive.append(Buffer.from(htmlWithInlineImages, "utf-8"), {
          name: `sertifikat_${certNum}${safeName}.html`,
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
