import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { registrations, seminars, certificates } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { sendCertificate } from "@/lib/whatsapp";
import { generateCertificateNumber } from "@/lib/certificate-number";
import { generateId } from "@/lib/utils";

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

// POST: Kirim sertifikat via WhatsApp
export async function POST(request: Request) {
  const user = getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { registrationId } = await request.json();

    if (!registrationId) {
      return NextResponse.json(
        { error: "ID pendaftaran harus diisi" },
        { status: 400 },
      );
    }

    // Ambil data peserta
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

    // Ambil data seminar
    const [seminar] = await db
      .select()
      .from(seminars)
      .where(eq(seminars.id, reg.seminarId))
      .limit(1);

    if (!seminar) {
      return NextResponse.json(
        { error: "Seminar tidak ditemukan" },
        { status: 404 },
      );
    }

    // Validasi nomor telepon
    if (!reg.phoneNumber) {
      return NextResponse.json(
        { error: "Peserta tidak memiliki nomor telepon" },
        { status: 400 },
      );
    }

    // Generate unique certificate number jika belum ada
    let certNumber = "";
    if (reg.certificateCode) {
      // Gunakan nomor yang sudah tersimpan
      certNumber = reg.certificateCode.startsWith("NO : ") ? reg.certificateCode : `NO : ${reg.certificateCode}`;
    } else {
      // Generate nomor baru untuk peserta lama (sebelum fitur ini)
      try {
        const certResult = await generateCertificateNumber(reg.id, reg.seminarId);
        certNumber = certResult.code.startsWith("NO : ") ? certResult.code : `NO : ${certResult.code}`;
      } catch (certErr) {
        console.warn("Certificate number generation failed:", certErr);
      }
    }

    // Kirim sertifikat via WhatsApp
    const seminarDate = String(seminar.date).split("T")[0];
    
    const result = await sendCertificate(
      reg.phoneNumber,
      reg.fullName,
      seminar.title,
      seminarDate,
      certNumber,
    );

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 502 });
    }

    // Update flag certificateSent
    await db
      .update(registrations)
      .set({ certificateSent: true })
      .where(eq(registrations.id, registrationId));

    // Simpan record ke tabel certificates
    const certId = generateId();
    await db.insert(certificates).values({
      id: certId,
      userId: registrationId,
      title: seminar.title,
      certificateNumber: certNumber,
      fileUrl: null,
      generatedDate: new Date(),
      isDeleted: false,
    });

    return NextResponse.json({
      success: true,
      message: `Sertifikat berhasil dikirim ke ${reg.phoneNumber}`,
      certificateNumber: certNumber,
    });
  } catch (error) {
    console.error("Send certificate error:", error);
    return NextResponse.json(
      { error: "Gagal mengirim sertifikat" },
      { status: 500 },
    );
  }
}
