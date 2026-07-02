import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { registrations, attendance } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { v4 as uuidv4 } from "uuid";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || (session.role !== "admin" && session.role !== "attendance_officer")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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

    // Mark as present
    await db
      .update(registrations)
      .set({
        isPresent: true,
        presentTime: new Date(),
        presentMethod: "qr",
      })
      .where(eq(registrations.id, registration.id));

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