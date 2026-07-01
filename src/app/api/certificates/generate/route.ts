import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  registrations,
  seminars,
  speakers,
  signatureSettings,
  certificateNumberSettings,
} from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import puppeteer from "puppeteer";

// GET: Generate sertifikat (HTML untuk print / PDF untuk download)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const registrationId = searchParams.get("registrationId");
    const seminarId = searchParams.get("seminarId");
    const format = searchParams.get("format");
    const autoPrint = searchParams.get("print") === "true";
    const search = searchParams.get("search")?.trim() || "";

    if (!registrationId || !seminarId) {
      return NextResponse.json(
        { error: "registrationId dan seminarId harus diisi" },
        { status: 400 },
      );
    }

    const [reg] = await db
      .select()
      .from(registrations)
      .where(eq(registrations.id, registrationId))
      .limit(1);

    if (!reg) {
      return NextResponse.json(
        { error: "Pendaftaran tidak ditemukan" },
        { status: 404 },
      );
    }

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

    // Ambil materi dari tabel speakers (topic) - tidak fallback ke description
    const speakerMaterials = await db
      .select({
        topic: speakers.topic,
      })
      .from(speakers)
      .where(and(eq(speakers.seminarId, seminarId), eq(speakers.isDeleted, false)))
      .orderBy(speakers.displayOrder);

    // Filter hanya yang memiliki topic
    let materialsList = speakerMaterials
      .filter((sm) => sm.topic && sm.topic.trim())
      .map((sm) => ({ topic: sm.topic!.trim() }));

    // Apply search filter if provided
    if (search) {
      const searchLower = search.toLowerCase();
      materialsList = materialsList.filter((m) =>
        m.topic.toLowerCase().includes(searchLower)
      );
    }

    const [activeSignature] = await db
      .select()
      .from(signatureSettings)
      .where(eq(signatureSettings.isActive, true))
      .limit(1);

    const [certNumberSettings] = await db
      .select()
      .from(certificateNumberSettings)
      .where(eq(certificateNumberSettings.isDeleted, false))
      .limit(1);

    let certNumber = "";
    if (certNumberSettings) {
      const months = [
        "I",
        "II",
        "III",
        "IV",
        "V",
        "VI",
        "VII",
        "VIII",
        "IX",
        "X",
        "XI",
        "XII",
      ];
      const monthRoman = months[new Date().getMonth()];
      certNumber = certNumberSettings.format
        .replace("{prefix}", certNumberSettings.letterPrefix)
        .replace("{letterno}", certNumberSettings.letterNo)
        .replace(
          "{nomor}",
          String(certNumberSettings.currentNumber).padStart(3, "0"),
        )
        .replace("{kode}", certNumberSettings.institutionCode)
        .replace("{bulan}", monthRoman)
        .replace("{tahun}", certNumberSettings.year);

      await db
        .update(certificateNumberSettings)
        .set({
          currentNumber: certNumberSettings.currentNumber + 1,
          updatedAt: new Date(),
        })
        .where(eq(certificateNumberSettings.id, certNumberSettings.id));
    }

    const seminarDate = new Date(seminar.date);
    const options: Intl.DateTimeFormatOptions = {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    };
    const tanggalStr = seminarDate.toLocaleDateString("id-ID", options);

    const html = generateCertificateHtml(
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

    if (format === "pdf") {
      try {
        const pdfBuffer = await generatePdf(html);
        return new Response(pdfBuffer as unknown as Blob, {
          status: 200,
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="sertifikat_${reg.fullName.replace(/\s+/g, "_")}.pdf"`,
          },
        });
      } catch (pdfError) {
        console.error("PDF generation error:", pdfError);
        return new NextResponse(html, {
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      }
    }

    return new NextResponse(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (error) {
    console.error("Generate certificate error:", error);
    return NextResponse.json(
      { error: "Gagal generate sertifikat" },
      { status: 500 },
    );
  }
}

// POST: Generate dan simpan sertifikat sebagai PDF
export async function POST(request: Request) {
  try {
    const { registrationId, seminarId } = await request.json();
    if (!registrationId || !seminarId) {
      return NextResponse.json(
        { error: "registrationId dan seminarId harus diisi" },
        { status: 400 },
      );
    }
    const [reg] = await db
      .select()
      .from(registrations)
      .where(eq(registrations.id, registrationId))
      .limit(1);
    if (!reg)
      return NextResponse.json(
        { error: "Pendaftaran tidak ditemukan" },
        { status: 404 },
      );
    const [seminar] = await db
      .select()
      .from(seminars)
      .where(eq(seminars.id, seminarId))
      .limit(1);
    if (!seminar)
      return NextResponse.json(
        { error: "Seminar tidak ditemukan" },
        { status: 404 },
      );
    const seminarDate = new Date(seminar.date);
    const options: Intl.DateTimeFormatOptions = {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    };
    const tanggalStr = seminarDate.toLocaleDateString("id-ID", options);
    return NextResponse.json({
      success: true,
      message: "Sertifikat siap di-generate",
      data: {
        participantName: reg.fullName,
        seminarTitle: seminar.title,
        date: tanggalStr,
        htmlEndpoint: `/api/certificates/generate?registrationId=${registrationId}&seminarId=${seminarId}`,
        pdfEndpoint: `/api/certificates/generate?registrationId=${registrationId}&seminarId=${seminarId}&format=pdf`,
      },
    });
  } catch (error) {
    console.error("Certificate generation error:", error);
    return NextResponse.json(
      { error: "Gagal memproses sertifikat" },
      { status: 500 },
    );
  }
}

async function generatePdf(html: string): Promise<Buffer> {
  const browser = await puppeteer.launch({
    headless: true,
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
    await page.setContent(html, { waitUntil: "networkidle0" });
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

interface MaterialItem {
  name?: string;
  topic: string;
}
interface SignatureData {
  name: string;
  position: string;
  nip?: string;
  signatureImage?: string;
}

function generateCertificateHtml(
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
        ${certNumber ? `<div class="cert-number">No : ${certNumber}</div>` : ""}
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
          <div class="signature-position">${sigPosition}</div>
          <div class="signature-space ${sigImage ? "has-signature" : ""}"></div>
          ${sigImage ? `<img src="${sigImage}" alt="Tanda Tangan" class="signature-img" />` : ""}
          <div class="signature-name">${sigName}</div>
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
