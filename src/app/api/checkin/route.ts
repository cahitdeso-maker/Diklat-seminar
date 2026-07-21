import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { registrations, seminars, certificates } from "@/lib/schema";
import { eq, and, desc, ilike } from "drizzle-orm";
import { generateId } from "@/lib/utils";
import { generateCertificateNumber } from "@/lib/certificate-number";
import { v4 as uuidv4 } from "uuid";

// GET: 
//   - ?seminarId=xxx → ambil detail seminar (public)
//   - ?seminarId=xxx&search=yyy → cari peserta by nama (public)
//   - tanpa params → ambil seminar yang useManual=true
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const seminarId = searchParams.get("seminarId");
    const search = searchParams.get("search")?.trim() || "";

    if (seminarId && !search) {
      // Ambil detail seminar by ID (public, tanpa auth)
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

      return NextResponse.json(seminar);
    }

    if (seminarId && search) {
      // Cari peserta by nama (public, tanpa auth)
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

      if (!seminar.useManual) {
        return NextResponse.json(
          { error: "Daftar hadir manual tidak aktif untuk seminar ini" },
          { status: 403 },
        );
      }

      if (!seminar.presensiOpen) {
        return NextResponse.json(
          { error: "Presensi untuk seminar ini sedang ditutup oleh admin" },
          { status: 403 },
        );
      }

      const data = await db
        .select()
        .from(registrations)
        .where(
          and(
            eq(registrations.seminarId, seminarId),
            eq(registrations.isDeleted, false),
            ilike(registrations.fullName, `%${search}%`),
          ),
        )
        .orderBy(desc(registrations.createdAt))
        .limit(20);

      return NextResponse.json(data);
    }

    // Ambil seminar yang menggunakan daftar hadir manual, aktif, dan belum selesai
    const data = await db
      .select()
      .from(seminars)
      .where(
        and(
          eq(seminars.isDeleted, false),
          eq(seminars.isActive, true),
          eq(seminars.isCompleted, false),
          eq(seminars.presensiOpen, true),
          eq(seminars.useManual, true),
        ),
      )
      .orderBy(desc(seminars.date));

    return NextResponse.json(data);
  } catch (error) {
    console.error("Checkin GET error:", error);
    return NextResponse.json(
      { error: "Gagal memuat data" },
      { status: 500 },
    );
  }
}

// POST: Daftar peserta + langsung presensi (isPresent = true)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { seminarId, fullName, email, phoneNumber, institution, profession } =
      body;

    if (!seminarId || !fullName) {
      return NextResponse.json(
        { error: "Seminar dan nama peserta harus diisi" },
        { status: 400 },
      );
    }

    // Cek seminar
    const [seminar] = await db
      .select()
      .from(seminars)
      .where(eq(seminars.id, seminarId))
      .limit(1);

    if (!seminar || seminar.isDeleted) {
      return NextResponse.json(
        { error: "Seminar tidak ditemukan" },
        { status: 404 },
      );
    }

    if (!seminar.isActive) {
      return NextResponse.json(
        { error: "Pendaftaran seminar sudah ditutup" },
        { status: 403 },
      );
    }

    if (!seminar.useManual) {
      return NextResponse.json(
        { error: "Daftar hadir manual tidak aktif untuk seminar ini" },
        { status: 403 },
      );
    }

    if (!seminar.presensiOpen) {
      return NextResponse.json(
        { error: "Presensi untuk seminar ini sedang ditutup oleh admin" },
        { status: 403 },
      );
    }

    // Cek kuota
    if (seminar.maxParticipants && seminar.maxParticipants > 0) {
      const count = await db
        .select()
        .from(registrations)
        .where(
          and(
            eq(registrations.seminarId, seminarId),
            eq(registrations.isDeleted, false),
          ),
        );

      if (count.length >= seminar.maxParticipants) {
        return NextResponse.json(
          { error: "Maaf, kuota peserta sudah penuh" },
          { status: 403 },
        );
      }
    }

    const id = generateId();

    // Insert langsung dengan isPresent = true (langsung presensi)
    await db.insert(registrations).values({
      id,
      seminarId,
      fullName,
      email: email || null,
      phoneNumber: phoneNumber || null,
      institution: institution || null,
      profession: profession || null,
      qrCode: null,
      isPresent: true,
      presentTime: new Date(),
      presentMethod: "manual",
      certificateSent: false,
      isDeleted: false,
    });

    // Auto-generate certificate number
    let certResult = null;
    try {
      certResult = await generateCertificateNumber(id, seminarId);
    } catch (certErr) {
      console.warn("Certificate number generation skipped:", certErr);
    }

    // Simpan record ke tabel certificates jika nomor berhasil digenerate
    if (certResult) {
      await db.insert(certificates).values({
        id: uuidv4(),
        userId: id,
        title: seminar.title,
        certificateNumber: certResult.code,
        fileUrl: null,
        generatedDate: new Date(),
        isDeleted: false,
      });
    }

    return NextResponse.json({
      success: true,
      message: "Check-in berhasil!",
      registration: {
        id,
        fullName,
        seminarTitle: seminar.title,
        seminarDate: seminar.date,
        seminarLocation: seminar.location,
      },
    });
  } catch (error) {
    console.error("Checkin POST error:", error);
    return NextResponse.json(
      { error: "Gagal melakukan check-in" },
      { status: 500 },
    );
  }
}