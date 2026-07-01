import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { speakers } from "@/lib/schema";
import { eq, and, asc } from "drizzle-orm";
import { generateId } from "@/lib/utils";

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

// GET: Ambil daftar speaker berdasarkan seminarId
export async function GET(request: Request) {
  const user = getSessionUser(request);
  if (!user) {
    console.error("[SPEAKERS_GET] Unauthorized - no valid session");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const seminarId = searchParams.get("seminarId");

    console.log("[SPEAKERS_GET] seminarId dari URL:", seminarId);

    if (!seminarId) {
      return NextResponse.json(
        { error: "seminarId harus diisi" },
        { status: 400 },
      );
    }

    console.log("[SPEAKERS_GET] Memulai query...");

    // Coba query dengan raw SQL dulu untuk debug
    try {
      const rawResult = await db.execute(
        `SELECT * FROM speakers WHERE seminar_id = '${seminarId}' AND is_deleted = false ORDER BY display_order`,
      );
      console.log(
        "[SPEAKERS_GET] Raw query result:",
        JSON.stringify(rawResult),
      );
    } catch (rawErr) {
      console.error("[SPEAKERS_GET] Raw query juga error:", rawErr);
    }

    const data = await db
      .select()
      .from(speakers)
      .where(
        and(eq(speakers.seminarId, seminarId), eq(speakers.isDeleted, false)),
      )
      .orderBy(asc(speakers.displayOrder));

    console.log("[SPEAKERS_GET] Data ditemukan:", data.length, "record(s)");
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("[SPEAKERS_GET] Error DETAIL:", error);
    console.error("[SPEAKERS_GET] Error message:", error?.message);
    console.error("[SPEAKERS_GET] Error stack:", error?.stack);
    return NextResponse.json(
      {
        error: "Gagal mengambil data pemateri",
        detail: error?.message || String(error),
        stack: error?.stack,
      },
      { status: 500 },
    );
  }
}

// POST: Tambah speaker baru
export async function POST(request: Request) {
  const user = getSessionUser(request);
  if (!user) {
    console.error("[SPEAKERS_POST] Unauthorized - no valid session");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { seminarId, name, topic } = body;

    console.log(
      "[SPEAKERS_POST] Data diterima:",
      JSON.stringify({ seminarId, name, topic }),
    );

    if (!seminarId || !name) {
      return NextResponse.json(
        { error: "seminarId dan nama pemateri harus diisi" },
        { status: 400 },
      );
    }

    // Hitung order terakhir
    const existing = await db
      .select()
      .from(speakers)
      .where(
        and(eq(speakers.seminarId, seminarId), eq(speakers.isDeleted, false)),
      )
      .orderBy(asc(speakers.displayOrder));

    const nextOrder =
      existing.length > 0 ? existing[existing.length - 1].displayOrder + 1 : 1;

    const id = generateId();
    await db.insert(speakers).values({
      id,
      seminarId,
      name,
      topic: topic || null,
      displayOrder: nextOrder,
      isDeleted: false,
    });

    console.log(
      "[SPEAKERS_POST] Berhasil insert speaker ID:",
      id,
      "seminarId:",
      seminarId,
    );

    return NextResponse.json({
      success: true,
      message: `Pemateri "${name}" berhasil ditambahkan`,
      speaker: {
        id,
        seminarId,
        name,
        topic: topic || null,
        displayOrder: nextOrder,
      },
    });
  } catch (error: any) {
    console.error("[SPEAKERS_POST] Error:", error);
    console.error("[SPEAKERS_POST] Error message:", error?.message);
    return NextResponse.json(
      {
        error: "Gagal menambahkan pemateri",
        detail: error?.message || String(error),
      },
      { status: 500 },
    );
  }
}

// PATCH: Update speaker
export async function PATCH(request: Request) {
  const user = getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const body = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: "ID pemateri harus diisi" },
        { status: 400 },
      );
    }

    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.topic !== undefined) updateData.topic = body.topic;
    if (body.displayOrder !== undefined)
      updateData.displayOrder = body.displayOrder;

    await db.update(speakers).set(updateData).where(eq(speakers.id, id));

    return NextResponse.json({
      success: true,
      message: "Pemateri berhasil diperbarui",
    });
  } catch (error) {
    console.error("Update speaker error:", error);
    return NextResponse.json(
      { error: "Gagal memperbarui pemateri" },
      { status: 500 },
    );
  }
}

// DELETE: Soft delete speaker
export async function DELETE(request: Request) {
  const user = getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "ID pemateri harus diisi" },
        { status: 400 },
      );
    }

    await db
      .update(speakers)
      .set({ isDeleted: true })
      .where(eq(speakers.id, id));

    return NextResponse.json({
      success: true,
      message: "Pemateri berhasil dihapus",
    });
  } catch (error) {
    console.error("Delete speaker error:", error);
    return NextResponse.json(
      { error: "Gagal menghapus pemateri" },
      { status: 500 },
    );
  }
}
