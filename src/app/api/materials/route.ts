import { NextResponse } from "next/server";
import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";
import { existsSync } from "fs";
import { saveMaterialFile, deleteMaterialFile } from "@/lib/materials";
import type { MaterialFile } from "@/lib/materials";

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

const MATERIALS_META_DIR = path.resolve("public", "uploads", "materials");

function getMetadataPath(seminarId: string): string {
  return path.join(MATERIALS_META_DIR, `${seminarId}-materials.json`);
}

async function getMaterials(seminarId: string): Promise<MaterialFile[]> {
  const metaPath = getMetadataPath(seminarId);
  if (!existsSync(metaPath)) return [];
  try {
    const content = await readFile(metaPath, "utf-8");
    return JSON.parse(content);
  } catch {
    return [];
  }
}

async function saveMaterials(
  seminarId: string,
  materials: MaterialFile[],
): Promise<void> {
  await mkdir(MATERIALS_META_DIR, { recursive: true });
  const metaPath = getMetadataPath(seminarId);
  await writeFile(metaPath, JSON.stringify(materials, null, 2));
}

// GET: Ambil daftar materi untuk seminar tertentu
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
        { error: "seminarId harus diisi" },
        { status: 400 },
      );
    }

    const materials = await getMaterials(seminarId);
    return NextResponse.json(materials);
  } catch (error) {
    console.error("Get materials error:", error);
    return NextResponse.json(
      { error: "Gagal mengambil data materi" },
      { status: 500 },
    );
  }
}

// POST: Upload materi baru
export async function POST(request: Request) {
  const user = getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const seminarId = formData.get("seminarId") as string;
    const file = formData.get("file") as File;

    if (!seminarId || !file) {
      return NextResponse.json(
        { error: "seminarId dan file harus diisi" },
        { status: 400 },
      );
    }

    const speakerName = (formData.get("speakerName") as string) || "";
    const material = await saveMaterialFile(file, seminarId, speakerName);

    // Simpan metadata
    const materials = await getMaterials(seminarId);
    materials.push(material);
    await saveMaterials(seminarId, materials);

    return NextResponse.json({
      success: true,
      message: `File "${file.name}" berhasil diupload`,
      material,
    });
  } catch (error: any) {
    console.error("Upload material error:", error);
    return NextResponse.json(
      { error: error.message || "Gagal mengupload file" },
      { status: 400 },
    );
  }
}

// PATCH: Update speaker name materi
export async function PATCH(request: Request) {
  const user = getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const seminarId = searchParams.get("seminarId");
    const materialId = searchParams.get("materialId");
    const body = await request.json();

    if (!seminarId || !materialId) {
      return NextResponse.json(
        { error: "seminarId dan materialId harus diisi" },
        { status: 400 },
      );
    }

    if (!body.speakerName) {
      return NextResponse.json(
        { error: "speakerName harus diisi" },
        { status: 400 },
      );
    }

    const materials = await getMaterials(seminarId);
    const material = materials.find((m) => m.id === materialId);

    if (!material) {
      return NextResponse.json(
        { error: "Materi tidak ditemukan" },
        { status: 404 },
      );
    }

    // Update speaker name
    material.speakerName = body.speakerName;
    await saveMaterials(seminarId, materials);

    return NextResponse.json({
      success: true,
      message: "Nama pemateri berhasil diupdate",
    });
  } catch (error) {
    console.error("Update material error:", error);
    return NextResponse.json(
      { error: "Gagal mengupdate materi" },
      { status: 500 },
    );
  }
}

// DELETE: Hapus materi
export async function DELETE(request: Request) {
  const user = getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const seminarId = searchParams.get("seminarId");
    const materialId = searchParams.get("materialId");

    if (!seminarId || !materialId) {
      return NextResponse.json(
        { error: "seminarId dan materialId harus diisi" },
        { status: 400 },
      );
    }

    const materials = await getMaterials(seminarId);
    const material = materials.find((m) => m.id === materialId);

    if (!material) {
      return NextResponse.json(
        { error: "Materi tidak ditemukan" },
        { status: 404 },
      );
    }

    // Hapus file dari disk
    await deleteMaterialFile(material);

    // Hapus dari metadata
    const updated = materials.filter((m) => m.id !== materialId);
    await saveMaterials(seminarId, updated);

    return NextResponse.json({
      success: true,
      message: `"${material.originalName}" berhasil dihapus`,
    });
  } catch (error) {
    console.error("Delete material error:", error);
    return NextResponse.json(
      { error: "Gagal menghapus materi" },
      { status: 500 },
    );
  }
}
