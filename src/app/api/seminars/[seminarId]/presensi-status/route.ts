import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { seminars } from "@/lib/schema";
import { eq } from "drizzle-orm";

// GET /api/seminars/[seminarId]/presensi-status - Public endpoint to check if presensi is open for a seminar
// GET /api/seminars/[seminarId]/presensi-status - Public endpoint to check if presensi is open for a seminar
export async function GET(
  request: Request,
  { params }: { params: Promise<{ seminarId: string }> }
) {
  try {
    const { seminarId } = await params;
    
    const [seminar] = await db
      .select({ presensiOpen: seminars.presensiOpen })
      .from(seminars)
      .where(eq(seminars.id, seminarId))
      .limit(1);

    if (!seminar) {
      return NextResponse.json(
        { error: "Seminar tidak ditemukan" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      open: seminar.presensiOpen === true,
    });
  } catch (error) {
    console.error("Get seminar presensi status error:", error);
    return NextResponse.json(
      { error: "Gagal memuat status presensi seminar" },
      { status: 500 }
    );
  }
}

// PUT /api/seminars/[seminarId]/presensi-status - Admin toggle presensi open/close for a seminar
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ seminarId: string }> }
) {
  try {
    const { seminarId } = await params;
    
    // Verify admin session
    const cookieHeader = request.headers.get("cookie") || "";
    const match = cookieHeader.match(/session=([^;]+)/);
    if (!match) {
      return NextResponse.json(
        { error: "Unauthorized. Silakan login sebagai admin." },
        { status: 401 }
      );
    }
    try {
      const data = JSON.parse(Buffer.from(match[1], "base64").toString());
      if (data.role !== "admin") {
        return NextResponse.json(
          { error: "Unauthorized. Hanya admin yang dapat mengubah status presensi." },
          { status: 403 }
        );
      }
    } catch {
      return NextResponse.json(
        { error: "Session tidak valid" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { open } = body;

    if (typeof open !== "boolean") {
      return NextResponse.json(
        { error: "Parameter 'open' (boolean) wajib diisi" },
        { status: 400 }
      );
    }

    // Cek seminar exists
    const [seminar] = await db
      .select({ id: seminars.id })
      .from(seminars)
      .where(eq(seminars.id, seminarId))
      .limit(1);

    if (!seminar) {
      return NextResponse.json(
        { error: "Seminar tidak ditemukan" },
        { status: 404 }
      );
    }

    // Update presensiOpen
    await db
      .update(seminars)
      .set({ presensiOpen: open })
      .where(eq(seminars.id, seminarId));

    return NextResponse.json({
      open,
      message: open
        ? "Presensi telah DIBUKA. Peserta kini dapat melakukan presensi."
        : "Presensi telah DITUTUP. Peserta tidak dapat melakukan presensi.",
    });
  } catch (error) {
    console.error("Update seminar presensi status error:", error);
    return NextResponse.json(
      { error: "Gagal mengubah status presensi seminar" },
      { status: 500 }
    );
  }
}