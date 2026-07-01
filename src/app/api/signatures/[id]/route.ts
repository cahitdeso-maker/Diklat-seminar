import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { signatureSettings } from "@/lib/schema";
import { eq } from "drizzle-orm";

// PUT /api/signatures/:id - Update penanda tangan
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, position, nip, signatureImage, isActive } = body;

    const [existing] = await db
      .select()
      .from(signatureSettings)
      .where(eq(signatureSettings.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { error: "Penanda tangan tidak ditemukan" },
        { status: 404 },
      );
    }

    await db
      .update(signatureSettings)
      .set({
        name: name ?? existing.name,
        position: position ?? existing.position,
        nip: nip !== undefined ? nip : existing.nip,
        signatureImage:
          signatureImage !== undefined
            ? signatureImage
            : existing.signatureImage,
        isActive: isActive ?? existing.isActive,
        updatedAt: new Date(),
      })
      .where(eq(signatureSettings.id, id));

    const [updated] = await db
      .select()
      .from(signatureSettings)
      .where(eq(signatureSettings.id, id))
      .limit(1);

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Update signature error:", error);
    return NextResponse.json(
      { error: "Gagal mengupdate penanda tangan" },
      { status: 500 },
    );
  }
}

// DELETE /api/signatures/:id - Hapus penanda tangan (soft delete)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const [existing] = await db
      .select()
      .from(signatureSettings)
      .where(eq(signatureSettings.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { error: "Penanda tangan tidak ditemukan" },
        { status: 404 },
      );
    }

    await db
      .update(signatureSettings)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(signatureSettings.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete signature error:", error);
    return NextResponse.json(
      { error: "Gagal menghapus penanda tangan" },
      { status: 500 },
    );
  }
}
