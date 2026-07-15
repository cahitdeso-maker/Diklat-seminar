import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { registrations, seminars, speakers, signatureSettings } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import { generateCertificateHtml, generateCertificatePdf } from "@/lib/certificate-pdf";

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

    // Gunakan certificateCode yang sudah tersimpan di registrasi
    let certNumber = "";
    if (reg.certificateCode) {
      // Tampilkan dengan prefix "NO : " jika belum ada
      certNumber = reg.certificateCode.startsWith("NO : ")
        ? reg.certificateCode
        : `NO : ${reg.certificateCode}`;
    } else {
      // Fallback: generate dari settings jika belum ada (untuk data lama)
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
        const pdfBuffer = await generateCertificatePdf(html);
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
