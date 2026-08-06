import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { registrations, attendance, certificates, seminars } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { generateCertificateNumber } from "@/lib/certificate-number";

// Public endpoint - NO AUTH REQUIRED
// Used by the public presensi page for face recognition attendance
export async function POST(req: NextRequest) {
  try {
    const { image, seminarId } = await req.json();

    if (!image) {
      return NextResponse.json({ error: "Gambar wajib diisi" }, { status: 400 });
    }

    // Get all registrations that have face data and haven't checked in
    const conditions = [eq(registrations.isPresent, false)];
    if (seminarId) {
      conditions.push(eq(registrations.seminarId, seminarId));
    }
    const regs = await db
      .select()
      .from(registrations)
      .where(and(...conditions));

    if (regs.length === 0) {
      return NextResponse.json({ error: "Tidak ada peserta yang belum hadir" }, { status: 404 });
    }

    // In a real implementation, you would use a face recognition service.
    // Untuk demo, ambil peserta pertama yang belum hadir — regs sudah difilter
    // isPresent = false di query di atas, jadi regs[0] selalu aman di sini.
    const notPresent = regs[0];

    // Generate certificate number (auto-generate saat presensi)
    let certResult = null;
    try {
      certResult = await generateCertificateNumber(notPresent.id, notPresent.seminarId);
    } catch (certErr) {
      console.warn("Certificate number generation skipped:", certErr);
    }

    // Mark as present
    await db
      .update(registrations)
      .set({
        isPresent: true,
        presentTime: new Date(),
        presentMethod: "face",
      })
      .where(eq(registrations.id, notPresent.id));

    // Ambil data seminar untuk title
    const [seminarData] = await db
      .select({ title: seminars.title })
      .from(seminars)
      .where(eq(seminars.id, notPresent.seminarId))
      .limit(1);

    // Simpan record ke tabel certificates jika nomor berhasil digenerate
    if (certResult) {
      await db.insert(certificates).values({
        id: uuidv4(),
        userId: notPresent.id,
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
      registrationId: notPresent.id,
      method: "face",
      timestamp: new Date(),
    });

    return NextResponse.json({
      success: true,
      participant: notPresent,
    });
  } catch (error) {
    console.error("Face attendance error:", error);
    return NextResponse.json({ error: "Gagal memproses presensi wajah" }, { status: 500 });
  }
}