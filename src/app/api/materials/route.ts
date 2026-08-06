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

    // speakerNames dikirim sebagai JSON array (mis. '["dr. A", "dr. B"]')
    let speakerNames: string[] = [];
    const rawSpeakerNames = formData.get("speakerNames") as string;
    if (rawSpeakerNames) {
      try {
        const parsed = JSON.parse(rawSpeakerNames);
        if (Array.isArray(parsed)) {
          speakerNames = parsed.filter((n) => typeof n === "string");
        }
      } catch {
        // fallback ke format lama: string dipisah koma
        speakerNames = rawSpeakerNames.split(",").map((s) => s.trim());
      }
    }
    const material = await saveMaterialFile(file, seminarId, speakerNames);

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

    // Terima array speakerNames (format baru) atau string speakerName (format lama)
    let speakerNames: string[] = [];
    if (Array.isArray(body.speakerNames)) {
      speakerNames = body.speakerNames.filter(
        (n: unknown) => typeof n === "string",
      );
    } else if (typeof body.speakerName === "string" && body.speakerName.trim()) {
      speakerNames = body.speakerName.split(",").map((s: string) => s.trim());
    }

    if (speakerNames.length === 0) {
      return NextResponse.json(
        { error: "speakerNames harus diisi" },
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

    // Update speaker names (array unik)
    const uniqueNames = Array.from(
      new Set(speakerNames.map((n) => n.trim()).filter(Boolean)),
    );
    material.speakerNames = uniqueNames;
    material.speakerName = uniqueNames.join(", ");
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
