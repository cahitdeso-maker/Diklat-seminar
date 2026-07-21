import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { seminars } from "@/lib/schema";
import { eq, desc, and } from "drizzle-orm";
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

// GET: Ambil semua seminar (yang aktif)
export async function GET(request: Request) {
  const user = getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const onlyActive = searchParams.get("active") !== "false";

    if (id) {
      const [seminar] = await db
        .select()
        .from(seminars)
        .where(eq(seminars.id, id))
        .limit(1);

      if (!seminar) {
        return NextResponse.json(
          { error: "Seminar tidak ditemukan" },
          { status: 404 },
        );
      }
      return NextResponse.json(seminar);
    }

    let data;
    if (onlyActive) {
      data = await db
        .select()
        .from(seminars)
        .where(and(eq(seminars.isDeleted, false), eq(seminars.isCompleted, false)))
        .orderBy(desc(seminars.date));
    } else {
      data = await db.select().from(seminars).orderBy(desc(seminars.date));
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Get seminars error:", error);
    return NextResponse.json(
      { error: "Gagal mengambil data seminar" },
      { status: 500 },
    );
  }
}

// POST: Buat seminar baru
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      title,
      description,
      date,
      startTime,
      endTime,
      location,
      maxParticipants,
      useQr,
      useFace,
      useManual,
    } = body;

    if (!title || !date) {
      return NextResponse.json(
        { error: "Judul dan tanggal seminar harus diisi" },
        { status: 400 },
      );
    }

    const id = generateId();
    await db.insert(seminars).values({
      id,
      title,
      description: description || null,
      date,
      startTime: startTime || null,
      endTime: endTime || null,
      location: location || null,
      maxParticipants: maxParticipants ? Number(maxParticipants) : 0,
      useQr: useQr !== false,
      useFace: useFace !== false,
      useManual: useManual === true,
      isActive: true,
      isDeleted: false,
    });

    return NextResponse.json({
      success: true,
      id,
      message: "Seminar berhasil dibuat",
    });
  } catch (error) {
    console.error("Create seminar error:", error);
    return NextResponse.json(
      { error: "Gagal membuat seminar" },
      { status: 500 },
    );
  }
}

// PATCH: Update seminar
export async function PATCH(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const body = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: "ID seminar harus diisi" },
        { status: 400 },
      );
    }

    // Check if seminar exists and is completed
    const [seminar] = await db
      .select()
      .from(seminars)
      .where(eq(seminars.id, id))
      .limit(1);

    if (!seminar) {
      return NextResponse.json(
        { error: "Seminar tidak ditemukan" },
        { status: 404 },
      );
    }

    // Prevent editing completed seminars (read-only)
    if (seminar.isCompleted) {
      return NextResponse.json(
        { error: "Seminar sudah selesai, tidak dapat diedit (hanya bisa dilihat)" },
        { status: 403 },
      );
    }

    const updateData: Record<string, unknown> = {};
    const fields = [
      "title",
      "description",
      "date",
      "startTime",
      "endTime",
      "location",
      "maxParticipants",
      "useQr",
      "useFace",
      "useManual",
      "isActive",
      "isCompleted",
      "presensiOpen",
      "isDeleted",
    ];

    for (const field of fields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    if (body.maxParticipants !== undefined)
      updateData.maxParticipants = Number(body.maxParticipants);

    await db.update(seminars).set(updateData).where(eq(seminars.id, id));

    return NextResponse.json({
      success: true,
      message: "Seminar berhasil diperbarui",
    });
  } catch (error) {
    console.error("Update seminar error:", error);
    return NextResponse.json(
      { error: "Gagal memperbarui seminar" },
      { status: 500 },
    );
  }
}

// DELETE: Soft delete seminar
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "ID seminar harus diisi" },
        { status: 400 },
      );
    }

    await db
      .update(seminars)
      .set({ isDeleted: true })
      .where(eq(seminars.id, id));

    return NextResponse.json({
      success: true,
      message: "Seminar berhasil dihapus",
    });
  } catch (error) {
    console.error("Delete seminar error:", error);
    return NextResponse.json(
      { error: "Gagal menghapus seminar" },
      { status: 500 },
    );
  }
}
