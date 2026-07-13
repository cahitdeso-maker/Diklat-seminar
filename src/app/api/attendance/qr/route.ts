import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { registrations, attendance, certificates, seminars } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { generateCertificateNumber } from "@/lib/certificate-number";

// Public endpoint - NO AUTH REQUIRED
// Used by the public presensi page for QR code attendance
export async function POST(req: NextRequest) {
  try {
    const { seminarId, qrCode } = await req.json();

    if (!seminarId || !qrCode) {
      return NextResponse.json({ error: "Seminar ID dan QR Code wajib diisi" }, { status: 400 });
    }

    // Find registration by QR code
    const reg = await db
      .select()
      .from(registrations)
      .where(and(eq(registrations.seminarId, seminarId), eq(registrations.qrCode, qrCode.toUpperCase())))
      .limit(1);

    if (reg.length === 0) {
      return NextResponse.json({ error: "QR Code tidak valid atau tidak ditemukan" }, { status: 404 });
    }

    const registration = reg[0];

    if (registration.isPresent) {
      return NextResponse.json({ error: "Peserta sudah melakukan presensi" }, { status: 400 });
    }

    // Generate certificate number (auto-generate saat presensi)
    let certResult = null;
    try {
      certResult = await generateCertificateNumber(registration.id, registration.seminarId);
    } catch (certErr) {
      console.warn("Certificate number generation skipped:", certErr);
    }

    // Mark as present
    await db
      .update(registrations)
      .set({
        isPresent: true,
        presentTime: new Date(),
        presentMethod: "qr",
      })
      .where(eq(registrations.id, registration.id));

    // Ambil data seminar untuk title
    const [seminarData] = await db
      .select({ title: seminars.title })
      .from(seminars)
      .where(eq(seminars.id, registration.seminarId))
      .limit(1);

    // Simpan record ke tabel certificates jika nomor berhasil digenerate
    if (certResult) {
      await db.insert(certificates).values({
        id: uuidv4(),
        userId: registration.id,
        title: seminarData?.title || "Sertifikat Seminar",
        certificateNumber: certResult.code,
        fileUrl: null,
        generatedDate: new Date(),
        isDeleted: false,
      });
    }

    // Also create attendance record
    await db.insert(attendance).values({
      id: uuidv4(),
      registrationId: registration.id,
      method: "qr",
      timestamp: new Date(),
    });

    return NextResponse.json({
      success: true,
      participant: registration,
    });
  } catch (error) {
    console.error("QR attendance error:", error);
    return NextResponse.json({ error: "Gagal memproses presensi QR Code" }, { status: 500 });
  }
}