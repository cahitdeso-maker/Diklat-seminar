import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { units } from "@/lib/schema";
import { eq } from "drizzle-orm";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const updateData: Record<string, unknown> = {};

    if (body.unitName !== undefined) updateData.unitName = body.unitName;
    if (body.latitude !== undefined)
      updateData.latitude = parseFloat(body.latitude);
    if (body.longitude !== undefined)
      updateData.longitude = parseFloat(body.longitude);
    if (body.radius !== undefined) updateData.radius = parseInt(body.radius);

    await db.update(units).set(updateData).where(eq(units.id, id));

    return NextResponse.json({
      success: true,
      message: "Unit berhasil diperbarui",
    });
  } catch (error) {
    console.error("Update unit error:", error);
    return NextResponse.json(
      { error: "Gagal memperbarui unit" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    await db.delete(units).where(eq(units.id, id));
    return NextResponse.json({
      success: true,
      message: "Unit berhasil dihapus",
    });
  } catch (error) {
    console.error("Delete unit error:", error);
    return NextResponse.json(
      { error: "Gagal menghapus unit" },
      { status: 500 },
    );
  }
}
