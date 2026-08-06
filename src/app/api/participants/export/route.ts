import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { registrations, seminars } from "@/lib/schema";
import { eq, and } from "drizzle-orm";

// ─── Auth ──────────────────────────────────────────────────────────────────

function getSessionUser(request: Request) {
  const cookieHeader = request.headers.get("cookie") || "";
  const match = cookieHeader.match(/session=([^;]+)/);
  if (!match) return null;
  try {
    const data = JSON.parse(Buffer.from(match[1], "base64").toString());
    return data.role === "admin" ? data : null;
  } catch {
    return null;
  }
}

// ─── Shared helpers ────────────────────────────────────────────────────────

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&" + "amp;")
    .replace(/</g, "&" + "lt;")
    .replace(/>/g, "&" + "gt;")
    .replace(/"/g, "&" + "quot;")
    .replace(/'/g, "&" + "#039;");
}

function formatDateTime(value: Date | string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (isNaN(date.getTime())) return "-";
  const dateStr = date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const timeStr = date.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${dateStr} ${timeStr}`;
}

// ─── PDF generation ────────────────────────────────────────────────────────

type SeminarRow = typeof seminars.$inferSelect;
type RegistrationRow = typeof registrations.$inferSelect;

function buildPdfHtml(
  seminar: SeminarRow,
  participantList: RegistrationRow[],
): string {
  const seminarDateRaw = seminar.date ? new Date(seminar.date) : null;
  const seminarDate =
    seminarDateRaw && !isNaN(seminarDateRaw.getTime())
      ? seminarDateRaw.toLocaleDateString("id-ID", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : "-";

  const rows = participantList
    .map(
      (p, i) => `
        <tr>
          <td class="center">${i + 1}</td>
          <td class="name">${escapeHtml(p.fullName)}</td>
          <td class="center mono">${p.certificateCode ? escapeHtml(p.certificateCode) : "-"}</td>
          <td>${p.email ? escapeHtml(p.email) : "-"}</td>
          <td>${p.phoneNumber ? escapeHtml(p.phoneNumber) : "-"}</td>
          <td>${p.institution ? escapeHtml(p.institution) : "-"}</td>
          <td>${p.profession ? escapeHtml(p.profession) : "-"}</td>
          <td class="center">${formatDateTime(p.presentTime)}</td>
        </tr>`,
    )
    .join("");

  const generatedAt = new Date().toLocaleString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <title>Daftar Peserta Hadir - ${escapeHtml(seminar.title)}</title>
  <style>
    @page { size: A4 portrait; margin: 18mm 15mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; color: #111827; font-size: 11px; }
    .header { text-align: center; border-bottom: 2px solid #033b5c; padding-bottom: 10px; margin-bottom: 16px; }
    .header h1 { font-size: 16px; color: #033b5c; margin-bottom: 4px; }
    .header p { font-size: 12px; color: #374151; }
    .meta { font-size: 11px; color: #4b5563; margin-bottom: 12px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #9ca3af; padding: 6px 8px; text-align: left; vertical-align: top; }
    th { background-color: #033b5c; color: #ffffff; font-weight: bold; text-align: center; }
    tr:nth-child(even) { background-color: #f2f8fc; }
    .center { text-align: center; }
    .mono { font-family: "Courier New", monospace; font-size: 10px; }
    .name { font-weight: bold; }
    .footer { margin-top: 14px; font-size: 10px; color: #6b7280; }
    .total { margin-top: 10px; font-weight: bold; font-size: 12px; color: #033b5c; }
  </style>
</head>
<body>
  <div class="header">
    <h1>DAFTAR PESERTA HADIR</h1>
    <p>${escapeHtml(seminar.title)}</p>
    <p>${escapeHtml(seminarDate)}</p>
  </div>
  <div class="meta">
    Tanggal unduh: ${generatedAt}
  </div>
  <table>
    <thead>
      <tr>
        <th style="width: 28px;">No</th>
        <th>Nama</th>
        <th style="width: 110px;">No. Sertifikat</th>
        <th>Email</th>
        <th style="width: 90px;">No. WA</th>
        <th>Institusi</th>
        <th>Profesi</th>
        <th style="width: 90px;">Waktu Presensi</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>
  <p class="total">Total peserta hadir: ${participantList.length} orang</p>
  <p class="footer">Dokumen ini dibuat otomatis oleh sistem Presensi Medis Pintar.</p>
</body>
</html>`;
}

async function generatePdf(html: string): Promise<Buffer<ArrayBuffer>> {
  const { launchBrowser } = await import("@/lib/puppeteer-browser");
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    await new Promise((resolve) => setTimeout(resolve, 300));
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
    });
    return Buffer.concat([Buffer.from(pdf)]);
  } finally {
    await browser.close();
  }
}

// ─── GET handler ───────────────────────────────────────────────────────────

/**
 * GET /api/participants/export?seminarId=xxx
 *
 * Menghasilkan PDF berisi daftar peserta yang sudah presensi (hadir) untuk
 * seminar tertentu. Hanya admin yang bisa mengakses.
 */
export async function GET(request: Request) {
  const user = getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const seminarId = searchParams.get("seminarId");

    if (!seminarId) {
      return NextResponse.json(
        { error: "seminarId harus diisi" },
        { status: 400 },
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

    const participantList = await db
      .select()
      .from(registrations)
      .where(
        and(
          eq(registrations.seminarId, seminarId),
          eq(registrations.isPresent, true),
          eq(registrations.isDeleted, false),
        ),
      )
      .orderBy(registrations.presentTime);

    if (participantList.length === 0) {
      return NextResponse.json(
        { error: "Belum ada peserta yang presensi untuk seminar ini" },
        { status: 404 },
      );
    }

    const safeTitle = seminar.title
      .replace(/[^a-zA-Z0-9\s]/g, "")
      .replace(/\s+/g, "_")
      .substring(0, 50);

    const html = buildPdfHtml(seminar, participantList);
    const buffer = await generatePdf(html);

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="daftar_hadir_${safeTitle}.pdf"`,
        "X-Total-Count": String(participantList.length),
      },
    });
  } catch (error) {
    console.error("Export peserta error:", error);
    return NextResponse.json(
      { error: "Gagal mendownload data peserta" },
      { status: 500 },
    );
  }
}