import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { seminars } from "@/lib/schema";
import { eq, desc, and } from "drizzle-orm";

// Public endpoint - NO AUTH REQUIRED
// Returns only active, non-deleted, non-completed seminars
export async function GET() {
  try {
    const data = await db
      .select({
        id: seminars.id,
        title: seminars.title,
        description: seminars.description,
        date: seminars.date,
        startTime: seminars.startTime,
        endTime: seminars.endTime,
        location: seminars.location,
        maxParticipants: seminars.maxParticipants,
      })
      .from(seminars)
      .where(
        and(
          eq(seminars.isDeleted, false),
          eq(seminars.isActive, true),
          eq(seminars.isCompleted, false),
          eq(seminars.presensiOpen, true),
        ),
      )
      .orderBy(desc(seminars.date));

    return NextResponse.json(data);
  } catch (error) {
    console.error("Public get seminars error:", error);
    return NextResponse.json(
      { error: "Gagal mengambil data seminar" },
      { status: 500 },
    );
  }
}