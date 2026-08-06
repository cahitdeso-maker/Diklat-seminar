import { db } from "@/lib/db";
import { registrations, seminars } from "@/lib/schema";
import { eq, and, isNotNull } from "drizzle-orm";
import {
  generateCertificatePdfsBulk,
  type BulkCertificateResult,
} from "@/lib/certificate-pdf";
import JSZip from "jszip";
import fs from "fs";
import os from "os";
import path from "path";
import { Readable } from "stream";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const seminarId = searchParams.get("seminarId");

  if (!seminarId) {
    return Response.json({ error: "seminarId harus diisi" }, { status: 400 });
  }

  const [seminar] = await db
    .select()
    .from(seminars)
    .where(eq(seminars.id, seminarId))
    .limit(1);

  if (!seminar) {
    return Response.json({ error: "Seminar tidak ditemukan" }, { status: 404 });
  }

  const participantList = await db
    .select({
      id: registrations.id,
      fullName: registrations.fullName,
      certificateNumber: registrations.certificateNumber,
      certificateCode: registrations.certificateCode,
    })
    .from(registrations)
    .where(
      and(
        eq(registrations.seminarId, seminarId),
        isNotNull(registrations.certificateNumber),
        eq(registrations.isDeleted, false),
      ),
    )
    .orderBy(registrations.certificateNumber);

  if (participantList.length === 0) {
    return Response.json(
      { error: "Tidak ada peserta yang sudah memiliki nomor sertifikat" },
      { status: 404 },
    );
  }

  // Generate semua PDF dengan SATU browser secara paralel — jauh lebih cepat
  // daripada generateCertificatePdf() per-peserta yang launch/close browser
  // untuk SETIAP PDF (biang keladi lambatnya bulk download ratusan peserta).
  let results: BulkCertificateResult[];
  try {
    results = await generateCertificatePdfsBulk(
      seminarId,
      participantList.map((p) => ({
        registrationId: p.id,
        fullName: p.fullName,
        certificateNumber: p.certificateNumber,
        certificateCode: p.certificateCode,
      })),
    );
  } catch (err) {
    console.error("Bulk certificate generation failed:", err);
    return Response.json(
      {
        error:
          "Gagal memproses sertifikat. Coba lagi, atau download dalam jumlah lebih kecil.",
      },
      { status: 500 },
    );
  }

  const zip = new JSZip();
  let successCount = 0;
  let failCount = 0;

  for (const r of results) {
    if (r.buffer) {
      zip.file(r.filename, r.buffer);
      successCount++;
    } else {
      failCount++;
    }
  }

  const safeTitle = seminar.title
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .replace(/\s+/g, "_")
    .substring(0, 50);

  const zipFilename = `sertifikat_${safeTitle}.zip`;

  // Tulis ZIP ke file sementara, lalu stream ke client.
  // - compression "STORE": PDF sudah terkompresi, DEFLATE hanya buang CPU.
  // - Streaming ke disk: hindari menampung seluruh ZIP di RAM (penting untuk
  //   ratusan PDF — PM2 punya batas max_memory_restart).
  const tmpPath = path.join(
    os.tmpdir(),
    `sertifikat-${Date.now()}-${Math.random().toString(36).slice(2)}.zip`,
  );

  await new Promise<void>((resolve, reject) => {
    const ws = fs.createWriteStream(tmpPath);
    zip
      .generateNodeStream({
        type: "nodebuffer",
        compression: "STORE",
        streamFiles: true,
      })
      .pipe(ws)
      .on("finish", () => resolve())
      .on("error", reject);
  });

  const stat = fs.statSync(tmpPath);
  const fileStream = fs.createReadStream(tmpPath);

  // Hapus file sementara SETELAH stream selesai dibaca client (event "close"
  // terpanggil baik saat selesai normal maupun saat client cancel). Ini lebih
  // aman daripada timer tetap — ZIP ratusan PDF bisa butuh beberapa menit
  // didownload di koneksi lambat.
  let cleanedUp = false;
  const cleanupFile = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    try {
      fs.rmSync(tmpPath, { force: true });
    } catch {}
  };
  fileStream.on("end", cleanupFile);
  fileStream.on("error", cleanupFile);
  fileStream.on("close", cleanupFile);

  // Pengaman tambahan: file tetap dihapus walau event close tidak pernah
  // terpanggil (mis. proses restart).
  const fallbackCleanup = setTimeout(cleanupFile, 30 * 60 * 1000);
  fallbackCleanup.unref?.();

  const body = Readable.toWeb(fileStream) as ReadableStream;

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${zipFilename}"`,
      "Content-Length": String(stat.size),
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "X-Total-Count": String(participantList.length),
      "X-Success-Count": String(successCount),
      "X-Fail-Count": String(failCount),
    },
  });
}
