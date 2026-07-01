import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { units } from "@/lib/schema";
import { generateId } from "@/lib/utils";

export async function GET() {
  try {
    const allUnits = await db.select().from(units);
    return NextResponse.json(allUnits);
  } catch (error) {
    console.error("Get units error:", error);
    return NextResponse.json(
      { error: "Gagal mengambil data unit" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const { unitName, latitude, longitude, radius } = await request.json();

    if (!unitName) {
      return NextResponse.json(
        { error: "Nama unit harus diisi" },
        { status: 400 },
      );
    }

    const id = generateId();
    await db.insert(units).values({
      id,
      unitName,
      latitude: latitude ? parseFloat(latitude) : 0,
      longitude: longitude ? parseFloat(longitude) : 0,
      radius: radius ? parseInt(radius) : 100,
    });

    return NextResponse.json({
      success: true,
      message: "Unit berhasil ditambahkan",
      unitId: id,
    });
  } catch (error) {
    console.error("Create unit error:", error);
    return NextResponse.json(
      { error: "Gagal menambahkan unit" },
      { status: 500 },
    );
  }
}
