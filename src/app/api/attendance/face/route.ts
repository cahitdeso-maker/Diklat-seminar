import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { registrations, attendance } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { v4 as uuidv4 } from "uuid";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session || (session.role !== "admin" && session.role !== "attendance_officer")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { image } = await req.json();

    if (!image) {
      return NextResponse.json({ error: "Gambar wajib diisi" }, { status: 400 });
    }

    // Get all registrations that have face data and haven't checked in
    const regs = await db
      .select()
      .from(registrations)
      .where(eq(registrations.isPresent, false));

    if (regs.length === 0) {
      return NextResponse.json({ error: "Tidak ada peserta yang belum hadir" }, { status: 404 });
    }

    // In a real implementation, you would use a face recognition service
    // For now, we'll simulate by finding a participant who hasn't checked in yet
    // and using a simple matching algorithm or external service
    
    // This is a placeholder - in production you would:
    // 1. Send the image to a face recognition service (AWS Rekognition, Azure Face API, etc.)
    // 2. Compare against registered face embeddings
    // 3. Return the matched participant
    
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
