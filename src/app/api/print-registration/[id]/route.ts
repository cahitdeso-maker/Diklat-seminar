import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { registrations, seminars } from "@/lib/schema";
import { eq } from "drizzle-orm";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const [reg] = await db
      .select()
      .from(registrations)
      .where(eq(registrations.id, id))
      .limit(1);

    if (!reg || reg.isDeleted) {
      return NextResponse.json(
        { error: "Pendaftaran tidak ditemukan" },
        { status: 404 }
      );
    }

    const [seminar] = await db
      .select()
      .from(seminars)
      .where(eq(seminars.id, reg.seminarId))
      .limit(1);

    if (!seminar) {
      return NextResponse.json(
        { error: "Seminar tidak ditemukan" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: reg.id,
      fullName: reg.fullName,
      email: reg.email,
      phoneNumber: reg.phoneNumber,
      institution: reg.institution,
      profession: reg.profession,
      qrCode: reg.qrCode,
      seminarTitle: seminar.title,
      seminarDate: seminar.date,
      seminarLocation: seminar.location,
    });
  } catch (error) {
    console.error("Print registration error:", error);
    return NextResponse.json(
      { error: "Gagal mengambil data pendaftaran" },
      { status: 500 }
    );
  }
}