import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { attendances, users, units } from "@/lib/schema";
import { generateId, isLate, getShift, calculateDistance } from "@/lib/utils";
import { eq } from "drizzle-orm";

export async function POST(request: Request) {
  try {
    const { userId, latitude, longitude, photoProof } = await request.json();

    if (!userId || !latitude || !longitude) {
      return NextResponse.json(
        { error: "Data tidak lengkap" },
        { status: 400 },
      );
    }

    const [student] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!student) {
      return NextResponse.json(
        { error: "Mahasiswa tidak ditemukan" },
        { status: 404 },
      );
    }

    if (!student.unitId) {
      return NextResponse.json(
        {
          error:
            "Anda belum ditempatkan ke unit. Silakan hubungi Admin Diklat.",
        },
        { status: 403 },
      );
    }

    const [unit] = await db
      .select()
      .from(units)
      .where(eq(units.id, student.unitId))
      .limit(1);

    if (!unit) {
      return NextResponse.json(
        { error: "Unit tidak ditemukan" },
        { status: 404 },
      );
    }

    const distance = calculateDistance(
      parseFloat(latitude),
      parseFloat(longitude),
      unit.latitude,
      unit.longitude,
    );

    if (distance > unit.radius) {
      return NextResponse.json(
        {
          error: `Anda berada di luar radius absensi. Jarak Anda: ${Math.round(distance)}m (Maks: ${unit.radius}m)`,
        },
        { status: 403 },
      );
    }

    const late = isLate();
    const shift = getShift();
    const now = new Date();

    const attendId = generateId();
    await db.insert(attendances).values({
      id: attendId,
      userId,
      scanTime: now,
      shift: shift.name,
      isLate: late,
      locationMap: `https://www.google.com/maps?q=${latitude},${longitude}`,
      photoProof: photoProof || null,
    });

    return NextResponse.json({
      success: true,
      message: late ? "Presensi berhasil! (Terlambat)" : "Presensi berhasil!",
      attendance: {
        id: attendId,
        time: now,
        shift: shift.label,
        isLate: late,
        distance: Math.round(distance),
        unitName: unit.unitName,
      },
    });
  } catch (error) {
    console.error("Attendance error:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan saat presensi" },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const unitId = searchParams.get("unitId");

    let records;
    if (userId) {
      records = await db
        .select()
        .from(attendances)
        .where(eq(attendances.userId, userId));
    } else {
      records = await db.select().from(attendances);
    }

    const enriched = await Promise.all(
      records.map(async (record: typeof attendances.$inferSelect) => {
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.id, record.userId))
          .limit(1);
        return {
          ...record,
          user: user
            ? {
                fullName: user.fullName,
                schoolOrigin: user.schoolOrigin,
                unitId: user.unitId,
              }
            : null,
        };
      }),
    );

    const filtered = unitId
      ? enriched.filter((r) => r.user !== null && r.user.unitId === unitId)
      : enriched;

    return NextResponse.json(filtered);
  } catch (error) {
    console.error("Get attendances error:", error);
    return NextResponse.json(
      { error: "Gagal mengambil data presensi" },
      { status: 500 },
    );
  }
}
