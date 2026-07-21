import puppeteer from "puppeteer";
import { db } from "./db";
import { registrations, seminars, speakers, signatureSettings } from "./schema";
import { eq, and } from "drizzle-orm";
import fs from "fs";
import path from "path";

// Cache for inlined images to avoid re-reading from disk
const imageCache = new Map<string, string>();

/**
 * Read an image file from the public directory and convert to base64 data URI.
 * Caches results so images are only read once.
 */
function getImageDataUri(imagePath: string): string {
  if (imageCache.has(imagePath)) {
    return imageCache.get(imagePath)!;
  }

  try {
    // Try both the absolute public path and the relative project path
    const publicDir = path.join(process.cwd(), "public");
    const fullPath = path.join(publicDir, imagePath.replace(/^\//, ""));
    
    if (fs.existsSync(fullPath)) {
      const ext = path.extname(fullPath).toLowerCase();
      const mimeMap: Record<string, string> = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".gif": "image/gif",
        ".webp": "image/webp",
        ".svg": "image/svg+xml",
      };
      const mime = mimeMap[ext] || "image/jpeg";
      const buffer = fs.readFileSync(fullPath);
      const dataUri = `data:${mime};base64,${buffer.toString("base64")}`;
      imageCache.set(imagePath, dataUri);
      return dataUri;
    }
  } catch (err) {
    console.warn(`Failed to load image: ${imagePath}`, err);
  }

  // Return empty placeholder if image not found
  return "";
}

/**
 * Replace all image src attributes in HTML with inline base64 data URIs.
 * This ensures images load correctly when generating PDFs with Puppeteer
 * (since Puppeteer runs headless without a server to serve static files).
 */
export function inlineCertificateImages(html: string): string {
  // Replace <img src="/img/..."> with inline data URIs
  // Note: Ensures a space before src= even when src is the first attribute
  return html.replace(
    /<img([^>]*?)src="(\/[^"]+?)"/g,
    (_match, before, src) => {
      const dataUri = getImageDataUri(src);
      if (dataUri) {
        return `<img${before} src="${dataUri}"`;
      }
      // Fallback: keep original src if image not found
      return `<img${before} src="${src}"`;
    },
  );
}

export interface MaterialItem {
  name?: string;
  topic: string;
}

export interface SignatureData {
  name: string;
  position: string;
  nip?: string;
  signatureImage?: string;
}

export interface ParticipantData {
  registrationId: string;
  seminarId: string;
  fullName: string;
  certificateCode?: string | null;
}

/**
 * Generate certificate HTML for a participant.
 */
export async function getCertificateHtml(
  registrationId: string,
  seminarId: string,
  autoPrint: boolean = false,
): Promise<string> {
  const [reg] = await db
    .select()
    .from(registrations)
    .where(eq(registrations.id, registrationId))
    .limit(1);

  if (!reg) throw new Error("Pendaftaran tidak ditemukan");

  const [seminar] = await db
    .select()
    .from(seminars)
    .where(eq(seminars.id, seminarId))
    .limit(1);

  if (!seminar) throw new Error("Seminar tidak ditemukan");

  // Ambil materi dari tabel speakers (topic)
  const speakerMaterials = await db
    .select({ topic: speakers.topic })
    .from(speakers)
    .where(and(eq(speakers.seminarId, seminarId), eq(speakers.isDeleted, false)))
    .orderBy(speakers.displayOrder);

  const materialsList = speakerMaterials
    .filter((sm) => sm.topic && sm.topic.trim())
    .map((sm) => ({ topic: sm.topic!.trim() }));

  const [activeSignature] = await db
    .select()
    .from(signatureSettings)
    .where(eq(signatureSettings.isActive, true))
    .limit(1);

  // Gunakan certificateCode yang sudah tersimpan di registrasi
  let certNumber = "";
  if (reg.certificateCode) {
    certNumber = reg.certificateCode.startsWith("NO : ")
      ? reg.certificateCode
      : `NO : ${reg.certificateCode}`;
  } else {
    try {
      const { generateCertificateNumber } = await import("@/lib/certificate-number");
      const result = await generateCertificateNumber(registrationId, seminarId);
      certNumber = result.code.startsWith("NO : ")
        ? result.code
        : `NO : ${result.code}`;
    } catch {
      certNumber = "";
    }
  }

  const seminarDate = new Date(seminar.date);
  const options: Intl.DateTimeFormatOptions = {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  };
  const tanggalStr = seminarDate.toLocaleDateString("id-ID", options);

  return generateCertificateHtml(
    reg.fullName,
    seminar.title,
    tanggalStr,
    materialsList,
    autoPrint,
    certNumber,
    activeSignature
      ? {
          name: activeSignature.name,
          position: activeSignature.position,
          nip: activeSignature.nip || undefined,
          signatureImage: activeSignature.signatureImage || undefined,
        }
      : undefined,
  );
}

/**
 * Generate PDF buffer from certificate HTML.
 * Automatically inlines images as base64 data URIs before rendering.
 */
export async function generateCertificatePdf(html: string): Promise<Buffer> {
  // Inline images before rendering with Puppeteer
  const htmlWithInlineImages = inlineCertificateImages(html);

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
    ],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1123, height: 794, deviceScaleFactor: 2 });
    await page.setContent(htmlWithInlineImages, { waitUntil: "networkidle0" });
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const pdfBuffer = await page.pdf({
      format: "A4",
      landscape: true,
      margin: { top: "0px", right: "0px", bottom: "0px", left: "0px" },
      printBackground: true,
      preferCSSPageSize: true,
    });
    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}

export function generateCertificateHtml(
  name: string,
  title: string,
  date: string,
  materials: MaterialItem[] = [],
  autoPrint: boolean = false,
  certNumber: string = "",
  signature?: SignatureData,
): string {
  const hasMaterials = materials.length > 0;
  const sigName = signature?.name;
  const sigPosition = signature?.position;
  const sigNip = signature?.nip;
  const sigImage = signature?.signatureImage;

  const certPage = `<div class="page cert-page">
    <div class="header-wrap">
      <img class="header-img" src="/img/atas.jpg" alt="Header Kop Surat" />
    </div>
    <div class="cert-body">
      <div class="cert-center">
        ${certNumber ? `<div class="cert-number">${certNumber}</div>` : ""}
        <div class="cert-label">Diberikan Kepada :</div>
        <div class="cert-name-wrap">
          <div class="cert-name">${name}</div>
          <div class="cert-underline"></div>
        </div>
        <div class="cert-role-label">Sebagai :</div>
        <div class="cert-role-value">PESERTA</div>
        <div class="cert-description">
          Dinyatakan telah LULUS dalam<br>
          ${title} pada tanggal ${date}<br>
          yang diselenggarakan di RS PKU Muhammadiyah Gombong
        </div>
        <div class="cert-signature">
          <div class="signature-date">Gombong, ${date.split(",").pop()?.trim() || date}</div>
          ${sigPosition ? `<div class="signature-position">${sigPosition}</div>` : ""}
          <div class="signature-space ${sigImage ? "has-signature" : ""}"></div>
          ${sigImage ? `<img src="${sigImage}" alt="Tanda Tangan" class="signature-img" />` : ""}
          ${sigName ? `<div class="signature-name">${sigName}</div>` : ""}
          ${sigNip ? `<div class="signature-nip">NIP. ${sigNip}</div>` : ""}
        </div>
      </div>
    </div>
    <div class="footer-wrap">
      <img class="footer-img" src="/img/bawah.jpg" alt="Footer Background" />
    </div>
  </div>`;

  const materialsPage = hasMaterials
    ? `<div class="page-break"></div>
  <div class="page cert-page">
    <div class="header-wrap">
      <img class="header-img" src="/img/atas_materi.jpg" alt="Header Materi" />
    </div>
    <div class="materials-body">
      <div class="materials-title">DAFTAR MATERI</div>
      <table class="materials-table">
        <thead><tr><th class="no-col">No</th><th>Materi</th></tr></thead>
        <tbody>${materials.map((m, i) => `<tr><td class="no-col">${i + 1}</td><td>${m.topic || m.name}</td></tr>`).join("")}</tbody>
      </table>
    </div>
    <div class="footer-wrap">
      <img class="footer-img" src="/img/bawah.jpg" alt="Footer Background" />
    </div>
  </div>`
    : "";

  const pages = [certPage];
  if (hasMaterials) {
    pages.push(materialsPage);
  }
  const allPages = pages.join("\n");

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Cetak Sertifikat - ${name}</title>
  <style>
    @page { size: A4 landscape; margin: 0; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none !important; }
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; font-family: Arial, Helvetica, sans-serif; background: #fff; }
    .page { width: 1123px; height: 794px; position: relative; overflow: hidden; display: flex; flex-direction: column; margin: 0 auto 40px; background: #fff; box-shadow: 0 0 15px rgba(0,0,0,.25); }
    .cert-page { break-after: page; page-break-after: always; }
    .page-break { break-before: page; page-break-before: always; }
    .header-wrap { width: 100%; flex-shrink: 0; }
    .header-img { width: 100%; display: block; }
    .cert-body { position: relative; width: 100%; flex: 1; display: flex; flex-direction: column; align-items: center; padding: 0 80px; }
    .cert-center { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; }
    .cert-number { font-size: 18px; font-weight: bold; color: #111; margin-bottom: 15px; }
    .cert-label { font-size: 18px; font-weight: bold; color: #111; margin-bottom: 10px; }
    .cert-name-wrap { width: 70%; text-align: center; margin-bottom: 20px; }
    .cert-name { font-size: 34px; font-weight: bold; color: #000; padding-bottom: 10px; }
    .cert-underline { position: relative; width: 65%; height: 6px; background: #033b5c; margin: 0 auto; }
    .cert-underline::before, .cert-underline::after { position: absolute; top: 50%; transform: translateY(-50%); color: #033b5c; font-size: 18px; line-height: 1; font-weight: bold; }
    .cert-underline::before { content: "▾▴▾▴▾▴▾▴"; position: absolute; left: -90px; letter-spacing: -6px; }
    .cert-underline::after { content: "▾▴▾▴▾▴▾▴"; position: absolute; left: 260px; right: -30px; letter-spacing: -6px; }
    .cert-role-label { font-size: 16px; font-weight: bold; color: #111; margin-bottom: 0px; }
    .cert-role-value { font-size: 26px; font-weight: bold; color: #0056B3; letter-spacing: 2px; margin-bottom: 20px; }
    .cert-description { font-size: 20px; color: #000; text-align: center; max-width: 900px; line-height: 1.5; font-weight: bold; transform: translateY(-10px); }
    .cert-signature { width: 100%; position: relative; display: flex; flex-direction: column; align-items: flex-end; transform: translateX(225px); text-align: center; font-size: 15px; color: #000; line-height: 1.5; }
    .signature-date { text-align: left; margin-top: -10px; margin-bottom: 5px; width: 350px; }
    .signature-position { width: 350px; margin-top: -10px; text-align: left; }
    .signature-name { width: 350px; font-weight: bold; text-decoration: underline; margin-top: 100px; position: relative; text-align: left; }
    .signature-nip { width: 350px; text-align: left; font-size: 13px; }
    .signature-img { position: absolute; left: 15; top: 40px; width: 350px; max-height: 150px; object-fit: contain; display: block; margin-bottom: -35px; background: transparent; }
    .footer-wrap { width: 100%; flex-shrink: 0; line-height: 0; }
    .footer-img { width: 100%; display: block; }
    .materials-body { width: 100%; flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 30px 80px; }
    .materials-title { font-size: 28px; font-weight: bold; color: #033b5c; text-align: center; margin-bottom: 8px; text-transform: uppercase; }
    .materials-table { width: 100%; border-collapse: collapse; font-size: 15px; }
    .materials-table th { background-color: #033b5c; color: #fff; padding: 10px 14px; text-align: center; font-weight: bold; border: 1px solid #000; font-size: 16px; }
    .materials-table td { padding: 8px 14px; text-align: center; border: 1px solid #000; color: #000; }
    .materials-table .no-col { text-align: center; width: 50px; }
    .materials-table tbody tr:nth-child(even) { background-color: #f2f8fc; }
    .no-print { position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%); z-index: 9999; display: flex; gap: 12px; }
    .no-print button { padding: 14px 32px; border: none; border-radius: 12px; font-size: 16px; font-weight: bold; cursor: pointer; box-shadow: 0 4px 20px rgba(0,0,0,0.2); transition: transform 0.2s, box-shadow 0.2s; }
    .no-print button:hover { transform: translateY(-2px); box-shadow: 0 6px 24px rgba(0,0,0,0.3); }
    .btn-print { background: #033b5c; color: #fff; }
    .btn-back { background: #e2e8f0; color: #333; }
  </style>
</head>
<body>
${allPages}
<div class="no-print">
  <button class="btn-print" onclick="window.print()">🖨️ Cetak / Simpan PDF</button>
  <button class="btn-back" onclick="window.close()">✕ Tutup</button>
</div>
<script>
(function() {
  var images = document.querySelectorAll('img');
  var loadedCount = 0;
  var totalImages = images.length;
  function imageLoaded() {
    loadedCount++;
    if (loadedCount >= totalImages) {
      document.body.classList.add('images-loaded');
      if (${autoPrint ? "true" : "false"}) { setTimeout(function() { window.print(); }, 500); }
    }
  }
  if (totalImages === 0) {
    document.body.classList.add('images-loaded');
    if (${autoPrint ? "true" : "false"}) { setTimeout(function() { window.print(); }, 500); }
  } else {
    for (var i = 0; i < totalImages; i++) {
      if (images[i].complete) { imageLoaded(); }
      else { images[i].onload = imageLoaded; images[i].onerror = imageLoaded; }
    }
  }
})();
</script>
</body>
</html>`;
}
