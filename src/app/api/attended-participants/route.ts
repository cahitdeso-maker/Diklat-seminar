import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { registrations, seminars } from "@/lib/schema";
import { eq, and, desc } from "drizzle-orm";

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

// GET: Ambil peserta yang sudah presensi (isPresent = true) per seminar
export async function GET(request: Request) {
  const user = getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const seminarId = searchParams.get("seminarId");

    if (!seminarId) {
      return NextResponse.json(
        { error: "Seminar ID harus diisi" },
        { status: 400 },
      );
    }

    // Ambil data seminar
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

    // Ambil peserta yang sudah presensi (isPresent = true)
    const attendedParticipants = await db
      .select()
      .from(registrations)
      .where(
        and(
          eq(registrations.seminarId, seminarId),
          eq(registrations.isDeleted, false),
          eq(registrations.isPresent, true),
        ),
      )
      .orderBy(desc(registrations.presentTime));

    return NextResponse.json({
      seminar: {
        id: seminar.id,
        title: seminar.title,
        date: seminar.date,
      },
      participants: attendedParticipants,
    });
  } catch (error) {
    console.error("Get attended participants error:", error);
    return NextResponse.json(
      { error: "Gagal mengambil data peserta hadir" },
      { status: 500 },
    );
  }
}