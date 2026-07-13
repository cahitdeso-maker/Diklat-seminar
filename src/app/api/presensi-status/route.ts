import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { settings } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import crypto from "crypto";

const SETTING_KEY = "presensi_open";

// GET /api/presensi-status - Public endpoint to check if presensi is open
export async function GET() {
  try {
    const [row] = await db
      .select()
      .from(settings)
      .where(eq(settings.settingKey, SETTING_KEY))
      .limit(1);

    const isOpen = row ? row.settingValue === "true" : false;

    return NextResponse.json({
      open: isOpen,
      updatedAt: row?.updatedAt ?? null,
    });
  } catch (error) {
    console.error("Get presensi status error:", error);
    return NextResponse.json(
      { error: "Gagal memuat status presensi" },
      { status: 500 },
    );
  }
}

// PUT /api/presensi-status - Admin-only endpoint to open/close presensi
export async function PUT(request: NextRequest) {
  try {
    // Verify admin session
    const session = getSession(request);
    if (!session || !session.userId) {
      return NextResponse.json(
        { error: "Unauthorized. Silakan login sebagai admin." },
        { status: 401 },
      );
    }

    const body = await request.json();
    const { open } = body;

    if (typeof open !== "boolean") {
      return NextResponse.json(
        { error: "Parameter 'open' (boolean) wajib diisi" },
        { status: 400 },
      );
    }

    const value = open ? "true" : "false";

    // Check if setting exists
    const [existing] = await db
      .select()
      .from(settings)
      .where(eq(settings.settingKey, SETTING_KEY))
      .limit(1);

    if (existing) {
      await db
        .update(settings)
        .set({ settingValue: value, updatedAt: new Date() })
        .where(eq(settings.id, existing.id));
    } else {
      await db.insert(settings).values({
        id: crypto.randomUUID(),
        settingKey: SETTING_KEY,
        settingValue: value,
      });
    }

    return NextResponse.json({
      open,
      message: open
        ? "Presensi telah DIBUKA. Peserta kini dapat melakukan presensi."
        : "Presensi telah DITUTUP. Peserta tidak dapat melakukan presensi.",
    });
  } catch (error) {
    console.error("Update presensi status error:", error);
    return NextResponse.json(
      { error: "Gagal mengubah status presensi" },
      { status: 500 },
    );
  }
}