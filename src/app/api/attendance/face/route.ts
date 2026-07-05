import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { registrations, attendance } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

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

    // In a real implementation, you would use a face recognition service
    // For now, we'll simulate by finding a participant who hasn't checked in yet
    
    // For demo purposes, we'll find the first participant who hasn't checked in
    const notPresent = regs.find((r) => !r.isPresent);
    
    if (!notPresent) {
      return NextResponse.json({ error: "Semua peserta sudah hadir" }, { status: 400 });
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