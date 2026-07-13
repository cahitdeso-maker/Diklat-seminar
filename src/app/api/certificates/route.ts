import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { certificates, registrations, seminars } from "@/lib/schema";
import { generateId } from "@/lib/utils";
import { eq, and } from "drizzle-orm";

// GET: Ambil semua sertifikat (filter by userId / title via query params jika perlu)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    let results;

    if (userId) {
      results = await db
        .select()
        .from(certificates)
        .where(eq(certificates.userId, userId));
    } else {
      results = await db.select().from(certificates);
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error("Get certificates error:", error);
    return NextResponse.json(
      { error: "Gagal mengambil data sertifikat" },
      { status: 500 },
    );
  }
}

// POST: Generate sertifikat untuk peserta
export async function POST(request: Request) {
  try {
    const { registrationId, seminarId } = await request.json();

    if (!registrationId || !seminarId) {
      return NextResponse.json(
        { error: "Registration ID dan Seminar ID harus diisi" },
        { status: 400 },
      );
    }

    // Verifikasi registrasi
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

    // Verifikasi seminar
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

    // Cek apakah sudah hadir
    if (!reg.isPresent) {
      return NextResponse.json(
        { error: "Peserta belum melakukan presensi" },
        { status: 403 },
      );
    }

    const certId = generateId();

    // Di tahap awal, kita simpan data sertifikat tanpa file PDF
    await db.insert(certificates).values({
      id: certId,
      userId: registrationId,
      title: seminar.title,
      fileUrl: null,
      generatedDate: new Date(),
      isDeleted: false,
    });

    // Update certificate_sent flag
    await db
      .update(registrations)
      .set({ certificateSent: true })
      .where(eq(registrations.id, registrationId));

    return NextResponse.json({
      success: true,
      message: "Sertifikat berhasil dibuat",
      certificate: {
        id: certId,
        registrationId,
        seminarId,
        participantName: reg.fullName,
        seminarTitle: seminar.title,
      },
    });
  } catch (error) {
    console.error("Certificate creation error:", error);
    return NextResponse.json(
      { error: "Gagal membuat sertifikat" },
      { status: 500 },
    );
  }
}

// DELETE: Hapus sertifikat
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "ID sertifikat harus diisi" },
        { status: 400 },
      );
    }

    await db
      .update(certificates)
      .set({ isDeleted: true })
      .where(eq(certificates.id, id));

    return NextResponse.json({
      success: true,
      message: "Sertifikat berhasil dihapus",
    });
  } catch (error) {
    console.error("Delete certificate error:", error);
    return NextResponse.json(
      { error: "Gagal menghapus sertifikat" },
      { status: 500 },
    );
  }
}
