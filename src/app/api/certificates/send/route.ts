import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { registrations, seminars } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { sendCertificate } from "@/lib/whatsapp";

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

    // Kirim sertifikat via WhatsApp
    const seminarDate = String(seminar.date).split("T")[0];
    
    const result = await sendCertificate(
      reg.phoneNumber,
      reg.fullName,
      seminar.title,
      seminarDate,
    );

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 502 });
    }

    // Update flag certificateSent
    await db
      .update(registrations)
      .set({ certificateSent: true })
      .where(eq(registrations.id, registrationId));

    return NextResponse.json({
      success: true,
      message: `Sertifikat berhasil dikirim ke ${reg.phoneNumber}`,
    });
  } catch (error) {
    console.error("Send certificate error:", error);
    return NextResponse.json(
      { error: "Gagal mengirim sertifikat" },
      { status: 500 },
    );
  }
}
