import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { registrations, seminars } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { getCertificateHtml, generateCertificatePdf } from "@/lib/certificate-pdf";

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

    // Ambil nama peserta untuk keperluan filename (query ringan, 1 field)
    const [reg] = await db
      .select({ fullName: registrations.fullName })
      .from(registrations)
      .where(eq(registrations.id, registrationId))
      .limit(1);

    const participantName = reg?.fullName || registrationId.substring(0, 8);
    const safeName = participantName.replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, "_");

    // Gunakan getCertificateHtml() yang sudah handle semua data fetching
    // (registrations, seminars, speakers, signatures, certificate number)
    const html = await getCertificateHtml(registrationId, seminarId, autoPrint, search);

    if (format === "pdf") {
      try {
        // Generate PDF via HTML + Puppeteer (hasil identik dengan cetakan)
        const pdfBuffer = await generateCertificatePdf(registrationId, seminarId);
        return new Response(pdfBuffer as unknown as Blob, {
          status: 200,
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="sertifikat_${safeName}.pdf"`,
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
