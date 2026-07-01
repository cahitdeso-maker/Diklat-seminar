import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { registrations, seminars } from "@/lib/schema";
import { eq, and, desc } from "drizzle-orm";
import { generateId } from "@/lib/utils";
import { saveBase64File } from "@/lib/save-file";

// Generate QR code string
function generateQrCode(): string {
  return (
    "SEMINAR-" +
    Date.now().toString(36).toUpperCase() +
    "-" +
    Math.random().toString(36).substr(2, 6).toUpperCase()
  );
}

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

// GET: Ambil registrasi by seminarId atau by id
export async function GET(request: Request) {
  const user = getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const seminarId = searchParams.get("seminarId");
    const registrationId = searchParams.get("id");

    if (registrationId) {
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
      return NextResponse.json(reg);
    }

    if (seminarId) {
      const data = await db
        .select()
        .from(registrations)
        .where(
          and(
            eq(registrations.seminarId, seminarId),
            eq(registrations.isDeleted, false),
          ),
        )
        .orderBy(desc(registrations.createdAt));

      return NextResponse.json(data);
    }

    // Ambil semua
    const data = await db
      .select()
      .from(registrations)
      .where(eq(registrations.isDeleted, false))
      .orderBy(desc(registrations.createdAt));

    return NextResponse.json(data);
  } catch (error) {
    console.error("Get registrations error:", error);
    return NextResponse.json(
      { error: "Gagal mengambil data pendaftaran" },
      { status: 500 },
    );
  }
}

// POST: Daftar seminar (peserta mendaftar sendiri)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      seminarId,
      fullName,
      email,
      phoneNumber,
      institution,
      profession,
      faceData,
    } = body;

    if (!seminarId || !fullName) {
      return NextResponse.json(
        { error: "Seminar dan nama peserta harus diisi" },
        { status: 400 },
      );
    }

    // Cek apakah seminar ada dan aktif
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
    const qrCode = generateQrCode();

    // Simpan faceData jika ada
    let faceFilePath: string | null = null;
    if (faceData && faceData.startsWith("data:")) {
      try {
        faceFilePath = await saveBase64File(faceData, id, "face");
      } catch (err) {
        console.error("Failed to save face photo:", err);
      }
    }

    await db.insert(registrations).values({
      id,
      seminarId,
      fullName,
      email: email || null,
      phoneNumber: phoneNumber || null,
      institution: institution || null,
      profession: profession || null,
      faceData: faceFilePath,
      qrCode,
      isPresent: false,
      certificateSent: false,
      isDeleted: false,
    });

    return NextResponse.json({
      success: true,
      message: "Pendaftaran berhasil!",
      registration: {
        id,
        qrCode,
        fullName,
        seminarTitle: seminar.title,
        seminarDate: seminar.date,
        seminarLocation: seminar.location,
      },
    });
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Gagal mendaftarkan peserta" },
      { status: 500 },
    );
  }
}

// PATCH: Update registration (mark present, dll)
export async function PATCH(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const body = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: "ID pendaftaran harus diisi" },
        { status: 400 },
      );
    }

    const updateData: Record<string, unknown> = {};

    if (body.isPresent !== undefined) {
      updateData.isPresent = body.isPresent;
      if (body.isPresent) {
        updateData.presentTime = new Date();
        updateData.presentMethod = body.presentMethod || "qr";
      }
    }
    if (body.certificateSent !== undefined)
      updateData.certificateSent = body.certificateSent;
    if (body.fullName !== undefined) updateData.fullName = body.fullName;
    if (body.email !== undefined) updateData.email = body.email;
    if (body.phoneNumber !== undefined)
      updateData.phoneNumber = body.phoneNumber;
    if (body.institution !== undefined)
      updateData.institution = body.institution;
    if (body.profession !== undefined) updateData.profession = body.profession;

    await db
      .update(registrations)
      .set(updateData)
      .where(eq(registrations.id, id));

    return NextResponse.json({
      success: true,
      message: "Data berhasil diperbarui",
    });
  } catch (error) {
    console.error("Update registration error:", error);
    return NextResponse.json(
      { error: "Gagal memperbarui data" },
      { status: 500 },
    );
  }
}

// DELETE: Soft delete registration
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "ID pendaftaran harus diisi" },
        { status: 400 },
      );
    }

    await db
      .update(registrations)
      .set({ isDeleted: true })
      .where(eq(registrations.id, id));

    return NextResponse.json({
      success: true,
      message: "Pendaftaran berhasil dihapus",
    });
  } catch (error) {
    console.error("Delete registration error:", error);
    return NextResponse.json(
      { error: "Gagal menghapus pendaftaran" },
      { status: 500 },
    );
  }
}
