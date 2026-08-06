import { db } from "./db";
import { registrations, seminars, speakers, signatureSettings } from "./schema";
import { eq, and } from "drizzle-orm";
import type { Page } from "puppeteer-core";
import fs from "fs";
import path from "path";
import sharp from "sharp";

// Cache for inlined images to avoid re-reading from disk
const imageCache = new Map<string, string>();
// Cache hasil proses tanda tangan (nama file unik per upload → aman di-cache)
const processedSignatureCache = new Map<string, string>();

// ─── Google Fonts helper (Noto Sans untuk karakter ▾▴) ──────────────────
// Di-fetch SEKALI dan di-cache di module level supaya tidak fetch ulang per peserta.
// Puppeteer via setContent() tidak punya akses server, jadi font harus di-embed
// sebagai base64 di dalam @font-face.

let _notoFontBase64: string | null = null;

async function getNotoSansFontBase64(): Promise<string> {
  // Langkah 1: fetch CSS Google Fonts untuk dapatkan URL woff2 yang benar
  const cssUrl =
    "https://fonts.googleapis.com/css2?family=Noto+Sans&display=swap&format=woff2";
  const cssRes = await fetch(cssUrl, {
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  if (!cssRes.ok) {
    console.warn(`Failed to fetch Google Fonts CSS: ${cssRes.status}`);
    return "";
  }
  const cssText = await cssRes.text();

  // Parse URL woff2 dari CSS (format: url(https://...woff2))
  const match = cssText.match(/url\((https:\/\/[^)]+?\.woff2)\)/);
  if (!match) {
    // Fallback: coba TTF jika woff2 tidak ada
    const ttfMatch = cssText.match(/url\((https:\/\/[^)]+?\.ttf)\)/);
    if (!ttfMatch) {
      console.warn("Could not find font URL in Google Fonts CSS response");
      return "";
    }
    const ttfUrl = ttfMatch[1];
    const res = await fetch(ttfUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!res.ok) return "";
    const buffer = await res.arrayBuffer();
    return Buffer.from(buffer).toString("base64");
  }

  const fontUrl = match[1];

  // Langkah 2: fetch font file
  const res = await fetch(fontUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) {
    console.warn(`Failed to fetch Noto Sans font (${fontUrl}): ${res.status}`);
    return "";
  }
  const buffer = await res.arrayBuffer();
  return Buffer.from(buffer).toString("base64");
}

async function getCachedNotoFont(): Promise<string> {
  if (!_notoFontBase64) {
    _notoFontBase64 = await getNotoSansFontBase64();
  }
  return _notoFontBase64;
}

/**
 * Baca file gambar dari folder public dan konversi ke base64 data URI.
 * Hasil di-cache untuk menghindari baca berulang.
 */
async function getProcessedSignatureDataUri(imagePath: string): Promise<string> {
  try {
    if (processedSignatureCache.has(imagePath)) {
      return processedSignatureCache.get(imagePath)!;
    }

    const publicDir = path.join(process.cwd(), "public");
    const fullPath = path.join(publicDir, imagePath.replace(/^\//, ""));
    if (!fs.existsSync(fullPath)) return "";

    // 1. Baca gambar sebagai raw RGB — warna asli DIJAGA (tidak dikonversi hitam-putih),
    //    sehingga warna tinta mengikuti file upload (mis. biru tetap biru).
    // Resolusi kerja dibatasi (max 1200px) karena tanda tangan hanya ditampilkan
    // ±250px — jauh lebih cepat tanpa mengubah hasil visual.
    const { data, info } = await sharp(fullPath)
      .removeAlpha()
      .toColourspace("srgb")
      .resize({ width: 1200, withoutEnlargement: true })
      .raw()
      .toBuffer({ resolveWithObject: true });

    const w = info.width;
    const h = info.height;
    const channels = info.channels; // 3 (RGB) setelah toColourspace

    // 2. Hitung kepekatan tinta tiap piksel = jarak Euclidean dari putih.
    //    - dist < 18 → noise putih, transparan penuh
    //    - dist < 60 → tepi anti-alias, alpha gradual (×2.2)
    //    - dist ≥ 60 → tinta jelas, OPAQUE PENUH (biar tebal, tidak tercuci)
    //    Warna RGB tetap mengikuti file upload.
    const alphaMap = new Uint8Array(w * h);
    const SQRT3 = Math.sqrt(3);
    for (let i = 0; i < w * h; i++) {
      const r = data[i * channels];
      const g = data[i * channels + 1];
      const b = data[i * channels + 2];
      const dr = 255 - r;
      const dg = 255 - g;
      const db = 255 - b;
      const dist = Math.sqrt(dr * dr + dg * dg + db * db) / SQRT3; // 0..255
      const base = dist < 18 ? 0 : Math.min(255, Math.round((dist - 18) * 2.2));
      alphaMap[i] = dist >= 60 && base > 0 ? 255 : base;
    }

    // 3. Pertebal goresan & pekatkan warna: joint max-filter 3×3 (dilasi).
    //    Setiap piksel mengadopsi warna piksel tinta terkuat di sekitarnya, lalu
    //    digelapkan sedikit (tinta penuh → ×0.7) — goresan lebih tebal & warna pekat.
    const rgba = Buffer.alloc(w * h * 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let bestA = 0;
        let bestIdx = 0;
        for (let dy = -1; dy <= 1; dy++) {
          const ny = y + dy;
          if (ny < 0 || ny >= h) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx;
            if (nx < 0 || nx >= w) continue;
            const idx = ny * w + nx;
            if (alphaMap[idx] > bestA) {
              bestA = alphaMap[idx];
              bestIdx = idx;
            }
          }
        }
        const outIdx = y * w + x;
        const src = bestIdx * channels;
        const darken = 1 - 0.3 * (bestA / 255); // tinta penuh → ×0.7, background → ×1
        rgba[outIdx * 4] = Math.min(255, Math.round(data[src] * darken));
        rgba[outIdx * 4 + 1] = Math.min(255, Math.round(data[src + 1] * darken));
        rgba[outIdx * 4 + 2] = Math.min(255, Math.round(data[src + 2] * darken));
        rgba[outIdx * 4 + 3] = bestA;
      }
    }

    // 4. Tulis sebagai PNG dengan alpha channel
    const result = await sharp(rgba, {
      raw: { width: w, height: h, channels: 4 },
    })
      .png()
      .toBuffer();

    const dataUri = `data:image/png;base64,${result.toString("base64")}`;
    processedSignatureCache.set(imagePath, dataUri);
    return dataUri;
  } catch (err) {
    console.warn(`Failed to process signature image: ${imagePath}`, err);
    return "";
  }
}

function getImageDataUri(imagePath: string): string {
  if (imageCache.has(imagePath)) {
    return imageCache.get(imagePath)!;
  }

  try {
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

  return "";
}

/**
 * Ganti semua src gambar relatif dengan inline base64 data URI.
 * Ini penting karena Puppeteer via setContent() tidak memiliki server
 * untuk melayani file statis.
 */
export function inlineCertificateImages(html: string): string {
  return html.replace(
    /<img([^>]*?)src="(\/[^"]+?)"/g,
    (_match, before, src) => {
      // Jangan inline data URI (sudah inline)
      if (src.startsWith("data:")) return _match;
      const dataUri = getImageDataUri(src);
      if (dataUri) {
        return `<img${before} src="${dataUri}"`;
      }
      return `<img${before} src="${src}"`;
    },
  );
}

// ─── Type Definitions ───────────────────────────────────────────────────────

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
 * Render PDF sertifikat LANGSUNG dari data live.
 * Pendekatan ini menghasilkan PDF yang IDENTIK dengan tampilan cetak di browser
 * karena menggunakan rendering engine Chrome yang sama.
 *
 * Ini adalah satu-satunya jalur rendering — generateCertificatePdf() memanggil
 * fungsi ini langsung tanpa menyimpan/membaca file di disk.
 */
export async function renderCertificatePdf(
  registrationId: string,
  seminarId: string,
): Promise<Buffer> {
  // Generate HTML certificate (reuse existing HTML template)
  const html = await getCertificateHtml(registrationId, seminarId);

  // Inline images as base64 data URIs (Puppeteer via setContent() tidak punya akses server)
  const htmlWithInlineImages = inlineCertificateImages(html);

  // Render HTML to PDF using Puppeteer
  const { launchBrowser } = await import("./puppeteer-browser");
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1123, height: 794, deviceScaleFactor: 2 });
    await page.setContent(htmlWithInlineImages, { waitUntil: "load" });

    // Tunggu semua gambar base64 selesai decode dan render
    await waitForCertificateImages(page, 300);

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

/**
 * Generate PDF sertifikat (public API — dipakai route cetak per peserta
 * dan bulk download).
 *
 * Selalu render LANGSUNG dari data live via renderCertificatePdf() — TIDAK
 * ada file tersimpan/terbaca di disk.
 */
export async function generateCertificatePdf(
  registrationId: string,
  seminarId: string,
): Promise<Buffer> {
  return renderCertificatePdf(registrationId, seminarId);
}

// ─── HTML Generation ────────────────────────────────────────────────────────

/**
 * Generate certificate HTML for browser display or Puppeteer PDF generation.
 */
export async function getCertificateHtml(
  registrationId: string,
  seminarId: string,
  autoPrint: boolean = false,
  search: string = "",
): Promise<string> {
  const [reg] = await db
    .select()
    .from(registrations)
    .where(eq(registrations.id, registrationId))
    .limit(1);

  if (!reg) throw new Error("Pendaftaran tidak ditemukan");

  let certNumber = "";
  if (reg.certificateCode) {
    certNumber = normalizeCertificateCode(reg.certificateCode);
  } else {
    try {
      const { generateCertificateNumber } = await import("./certificate-number");
      const result = await generateCertificateNumber(registrationId, seminarId);
      certNumber = normalizeCertificateCode(result.code);
    } catch {
      certNumber = "";
    }
  }

  // Data statis seminar (judul, tanggal, materi, tanda tangan, font) dimuat
  // SEKALI — dipakai juga oleh bulk download supaya tidak query DB berulang
  // untuk setiap peserta.
  const shared = await getCertificateSharedData(seminarId);

  // Apply search filter if provided
  let materialsList = shared.materialsList;
  if (search) {
    const searchLower = search.toLowerCase();
    materialsList = materialsList.filter((m) =>
      m.topic.toLowerCase().includes(searchLower),
    );
  }

  return generateCertificateHtml(
    reg.fullName,
    shared.title,
    shared.tanggalStr,
    materialsList,
    autoPrint,
    certNumber,
    shared.signatureDateStr,
    shared.signature,
    shared.fontBase64,
  );
}

// ─── Shared Seminar Data (dipakai render per-peserta & bulk download) ───────

export interface CertificateSharedData {
  title: string;
  tanggalStr: string;
  signatureDateStr: string;
  materialsList: MaterialItem[];
  signature?: SignatureData;
  fontBase64: string;
}

/**
 * Muat data statis sebuah seminar SEKALI: judul, rentang tanggal, daftar
 * materi, pengaturan tanda tangan, dan font embedded. Hasilnya dipakai
 * untuk SEMUA peserta dalam seminar yang sama sehingga query DB & proses
 * gambar tidak diulang-ulang.
 */
async function getCertificateSharedData(
  seminarId: string,
): Promise<CertificateSharedData> {
  const [seminar] = await db
    .select()
    .from(seminars)
    .where(eq(seminars.id, seminarId))
    .limit(1);

  if (!seminar) throw new Error("Seminar tidak ditemukan");

  const speakerMaterials = await db
    .select({ topic: speakers.topic })
    .from(speakers)
    .where(and(eq(speakers.seminarId, seminarId), eq(speakers.isDeleted, false)))
    .orderBy(speakers.displayOrder);

  const materialsList: MaterialItem[] = speakerMaterials
    .filter((sm) => sm.topic && sm.topic.trim())
    .map((sm) => ({ topic: sm.topic!.trim() }));

  const [activeSignature] = await db
    .select()
    .from(signatureSettings)
    .where(eq(signatureSettings.isActive, true))
    .limit(1);

  const seminarDate = new Date(seminar.date);
  const options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "long",
    day: "numeric",
  };
  let tanggalStr = seminarDate.toLocaleDateString("id-ID", options);
  let signatureDateStr = tanggalStr;
  if (seminar.endDate) {
    const seminarEndDate = new Date(seminar.endDate);
    const endDateStr = seminarEndDate.toLocaleDateString("id-ID", options);
    tanggalStr = `${tanggalStr} sampai dengan ${endDateStr}`;
    signatureDateStr = endDateStr;
  }

  // Fetch embedded Noto Sans font untuk karakter Unicode ▾▴ (hanya sekali, di-cache)
  const fontBase64 = await getCachedNotoFont();

  // Konversi signatureImage (URL relatif /uploads/...) ke base64 data URI
  // supaya Puppeteer via setContent() bisa render tanpa akses server.
  // Background putih dihapus (transparan) namun WARNA tinta dipertahankan sesuai
  // file upload, sehingga tanda tangan menyatu tanpa kotak putih.
  const signatureImageDataUri = activeSignature?.signatureImage
    ? (await getProcessedSignatureDataUri(activeSignature.signatureImage)) ||
      getImageDataUri(activeSignature.signatureImage) ||
      activeSignature.signatureImage
    : undefined;

  return {
    title: seminar.title,
    tanggalStr,
    signatureDateStr,
    materialsList,
    signature: activeSignature
      ? {
          name: activeSignature.name,
          position: activeSignature.position,
          nip: activeSignature.nip || undefined,
          signatureImage: signatureImageDataUri,
        }
      : undefined,
    fontBase64,
  };
}

/**
 * Tunggu semua gambar di halaman selesai decode, lalu beri buffer ekstra.
 * Gambar sudah berupa base64 data URI, jadi decode cepat — buffer besar
 * hanya membuang waktu saat render massal.
 */
async function waitForCertificateImages(page: Page, extraBufferMs: number): Promise<void> {
  await page.evaluate(() => {
    return new Promise<void>((resolve) => {
      const images = document.querySelectorAll("img");
      if (images.length === 0) { resolve(); return; }
      let loaded = 0;
      images.forEach((img) => {
        if (img.complete) {
          loaded++;
          if (loaded === images.length) resolve();
        } else {
          img.onload = img.onerror = () => {
            loaded++;
            if (loaded === images.length) resolve();
          };
        }
      });
    });
  });

  if (extraBufferMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, extraBufferMs));
  }
}

// ─── Bulk PDF Generation (Download Semua Sertifikat) ─────────────────────────

export interface BulkCertificateItem {
  registrationId: string;
  fullName: string;
  certificateNumber?: number | null;
  certificateCode?: string | null;
}

export interface BulkCertificateResult {
  filename: string;
  buffer?: Buffer;
  error?: string;
}

/** Normalisasi kode sertifikat agar konsisten diawali "NO : ". */
export function normalizeCertificateCode(code: string): string {
  return code.startsWith("NO : ") ? code : `NO : ${code}`;
}

/** Nama file PDF peserta (identik dengan format sebelumnya). */
export function buildPdfFilename(item: BulkCertificateItem): string {
  const safeName = item.fullName
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .replace(/\s+/g, "_")
    .substring(0, 80);
  const certNum =
    item.certificateNumber != null
      ? String(item.certificateNumber).padStart(4, "0") + "_"
      : "";
  return `sertifikat_${certNum}${safeName}.pdf`;
}

/**
 * Format nomor sertifikat untuk tampilan di PDF.
 * Tidak memanggil generateCertificateNumber() (yang menulis DB) — peserta
 * yang masuk bulk download sudah pasti punya nomor.
 */
function formatCertificateCode(item: BulkCertificateItem): string {
  if (item.certificateCode) {
    return normalizeCertificateCode(item.certificateCode);
  }
  if (item.certificateNumber != null) {
    return `NO : ${String(item.certificateNumber).padStart(4, "0")}`;
  }
  return "";
}

/**
 * Generate banyak PDF sertifikat sekaligus — pengganti loop
 * generateCertificatePdf() per-peserta yang lambat karena launch/close
 * browser untuk SETIAP PDF.
 *
 * Optimasi performa:
 * 1. SATU browser dipakai untuk semua peserta.
 * 2. Rendering diparalelkan dengan beberapa halaman (default 4).
 * 3. Data statis seminar dimuat SEKALI (getCertificateSharedData).
 * 4. Buffer tunggu gambar dipangkas (100ms) karena gambar base64 inline.
 */
export async function generateCertificatePdfsBulk(
  seminarId: string,
  items: BulkCertificateItem[],
  options: { concurrency?: number } = {},
): Promise<BulkCertificateResult[]> {
  const concurrency = Math.max(1, Math.min(options.concurrency ?? 4, 8));
  const results = new Array<BulkCertificateResult>(items.length);

  const shared = await getCertificateSharedData(seminarId);

  const { launchBrowser } = await import("./puppeteer-browser");
  const browser = await launchBrowser();
  try {
    let next = 0;
    const workerCount = Math.min(concurrency, items.length);

    const workers = Array.from({ length: workerCount }, async () => {
      let page: Page | null = null;
      try {
        page = await browser.newPage();
        await page.setViewport({ width: 1123, height: 794, deviceScaleFactor: 2 });

        while (next < items.length) {
          const i = next++;
          const item = items[i];
          const filename = buildPdfFilename(item);
          try {
            const certNumber = formatCertificateCode(item);
            const html = generateCertificateHtml(
              item.fullName,
              shared.title,
              shared.tanggalStr,
              shared.materialsList,
              false,
              certNumber,
              shared.signatureDateStr,
              shared.signature,
              shared.fontBase64,
            );
            const htmlWithInlineImages = inlineCertificateImages(html);

            await page.setContent(htmlWithInlineImages, { waitUntil: "load" });
            await waitForCertificateImages(page, 100);

            const pdfBuffer = await page.pdf({
              format: "A4",
              landscape: true,
              margin: { top: "0px", right: "0px", bottom: "0px", left: "0px" },
              printBackground: true,
              preferCSSPageSize: true,
            });

            results[i] = { filename, buffer: Buffer.from(pdfBuffer) };
          } catch (err) {
            console.error(`Gagal generate sertifikat untuk ${item.fullName}:`, err);
            results[i] = {
              filename,
              error: err instanceof Error ? err.message : String(err),
            };
          }
        }
      } catch (err) {
        console.error("[BulkPDF] Worker error:", err);
      } finally {
        await page?.close().catch(() => {});
      }
    });

    await Promise.all(workers);
  } finally {
    await browser.close().catch(() => {});
  }

  return results;
}

/**
 * Generate HTML string untuk sertifikat.
 * Template ini menghasilkan tampilan yang sama persis dengan cetakan yang sudah terbit.
 */
export function generateCertificateHtml(
  name: string,
  title: string,
  date: string,
  materials: MaterialItem[] = [],
  autoPrint: boolean = false,
  certNumber: string = "",
  signatureDate: string = "",
  signature?: SignatureData,
  fontBase64: string = "",
): string {
  const hasMaterials = materials.length > 0;
  const sigName = signature?.name;
  const sigPosition = signature?.position;
  const sigNip = signature?.nip;
  const sigImage = signature?.signatureImage;
  const formattedDate = date.replace(/^[^,]+,\s*/, "");

  const certPage = `<div class="page cert-page">
    <div class="header-wrap">
      <img class="header-img" src="/img/atas.jpg" alt="Header Kop Surat" />
    </div>
    <div class="cert-body">
      <div class="cert-center">
        ${certNumber ? `<div class="cert-number">${certNumber}</div>` : ""}
        <div class="cert-label">Diberikan Kepada :</div>
        <div style="text-align:center;">
      <div class="cert-name-wrap">
        <div class="cert-name">${name}</div>
        <div class="cert-underline"></div>
      </div>
      </div>
        <div class="cert-role-label">Sebagai :</div>
        <div class="cert-role-value">PESERTA</div>
        <div class="cert-description">
        <div class="cert-header">
            Dinyatakan telah LULUS dalam
        </div>
        <div class="cert-title">
            ${title}
        </div>
        <div class="cert-footer">
           pada tanggal ${formattedDate} yang diselenggarakan di RS PKU Muhammadiyah Gombong
        </div>
    </div>
        <div class="cert-signature">
          <div class="signature-date">Gombong, ${signatureDate || date}</div>
         <div class="signature-position-wrapper">
          ${sigPosition ? `<div class="signature-position">${sigPosition}</div>` : ""}</div>
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

  const fontFaceBlock = fontBase64
    ? `
@font-face {
  font-family: 'NotoSymbols';
  src: url('data:font/woff2;base64,${fontBase64}') format('woff2');
  unicode-range: U+25BE, U+25B4; /* hanya karakter ▾▴ */
}
`
    : "";

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Cetak Sertifikat - ${name}</title>
  <style>
    ${fontFaceBlock}    @page { size: A4 landscape; margin: 0; }
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
    .cert-body { 
          position: relative; 
          width: 100%; 
          flex: 1; 
          display: flex; 
          flex-direction: column; 
          align-items: center; 
          padding: 0 80px; }
    .cert-center { flex: 1; 
          display: flex; 
          flex-direction: column; 
          align-items: center; 
          justify-content: center; }
    .cert-number {
          font-size: 18px;
          font-weight: bold;
          color: #111;
          margin-bottom: 8px;
          position: relative;
          top: -10px; }
    .cert-label { font-size: 18px; font-weight: bold; color: #111; margin-bottom: 10px; margin-top: -18px; }
    .cert-name-wrap {
          display: inline-flex;
          flex-direction: column;
          align-items: stretch;
          margin: 0 auto 20px;
          text-align: center; }
    .cert-name {
          display: inline-block;
          align-self: center;
          width: fit-content;
          font-size: 34px;
          font-weight: bold;
          color: #000;
          padding: 0 30px 10px;
          white-space: nowrap;
          line-height: 1.2; }
    .cert-underline {
          position: relative;
          width: 100%;
          height: 6px;
          background: #033b5c;
          margin: 0 auto; }
    .cert-underline::before,
    .cert-underline::after {
          content: "▾▴▾▴▾▴▾▴";
          font-family: 'NotoSymbols', Arial, sans-serif; /* supaya karakter ▾▴ render di PDF */
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          color: #033b5c;
          font-size: 18px;
          font-weight: bold;
          letter-spacing: -6px;
          line-height: 1;
          background: #fff;
          // padding: 0 4px;
          z-index: 2; }

    .cert-underline::before {
          right: 100%;
          margin-right: 8px; }
    .cert-underline::after {
          left: 100%;
          margin-left: 0px; }
    .cert-role-label { font-size: 16px; font-weight: bold; color: #111; margin-bottom: 0px; margin-top: -5px; }
    .cert-role-value { font-size: 26px; font-weight: bold; color: #0056B3; letter-spacing: 2px; margin-bottom: 20px; }
    .cert-description {
            width: 100%;
            margin: 0 auto;
            text-align: center;
            color: #000;
            font-weight: bold;
            line-height: 1.4; }
    .cert-header {
            font-size: 20px;
            margin-top: -10px;
            // margin-bottom: 2px; }
    .cert-title {
            display: inline;
            max-width: 1100px;
            font-size: 20px;
            line-height: 1.4;
            // margin-bottom: 8px; }
    .cert-footer {
            display: inline;
            font-size: 20px;
            line-height: 1.4; }
   .cert-signature { 
              width: 100%; 
              position: relative; 
              display: flex; 
              flex-direction: column; 
              align-items: flex-end;
              padding-right: 100px;
              text-align: center; 
              font-size: 15px; 
              color: #000; 
              line-height: 1.5; }
    .signature-date { 
              width: 300px;
              text-align: left;
              margin-top: 10px; 
              margin-bottom: 5px; }
    .signature-position-wrapper {
              width: 300px;
              display: flex;
              margin-top: 8px;
              margin-bottom: -40px;
              text-align: left; 
              white-space: nowrap;}          
    .signature-position { 
              width: 300px; 
              margin-top: -10px; 
              text-align: left; }
    .signature-name { 
              width: 300px; 
              font-weight: bold; 
              text-decoration: underline;
              margin-top: 130px; 
              text-align: left;
              white-space: nowrap; }
    .signature-nip { 
              width: 300px;
              font-weight: bold;
              text-align: left; 
              font-size: 13px; }
    .signature-img { 
              position: absolute; 
              right: 30px;
              top: 35px; 
              width: 500px; 
              max-height: 120px; 
              object-fit: contain; 
              display: block;}
    .footer-wrap { width: 100%; flex-shrink: 0; line-height: 0; }
    .footer-img { width: 100%; display: block; }
.materials-body {
    width: 100%;
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    padding: 30px 80px;
    box-sizing: border-box;
}

.materials-title {
    width: 100%;
    font-size: 28px;
    font-weight: bold;
    color: #033b5c;
    text-align: center;
    margin: 0 0 15px 0;
    text-transform: uppercase;
    flex-shrink: 0;
}

.materials-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 15px;
    table-layout: fixed;
}

.materials-table th {
    background-color: #033b5c;
    color: #fff;
    padding: 10px 14px;
    text-align: center;
    font-weight: bold;
    border: 1px solid #000;
    font-size: 16px;
}

.materials-table td {
    padding: 8px 14px;
    text-align: center;
    border: 1px solid #000;
    color: #000;
    vertical-align: top;
}

.materials-table .no-col {
    width: 50px;
    text-align: center;
}

.materials-table tbody tr:nth-child(even) {
    background-color: #f2f8fc;
}
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
