/**
 * Materials Service
 *
 * Menangani upload & manajemen materi seminar
 */

import { writeFile, mkdir, unlink } from "fs/promises";
import path from "path";

export interface MaterialFile {
  id: string;
  name: string;
  originalName: string;
  url: string;
  size: number;
  type: string;
  speakerName: string; // nama pemateri
  uploadedAt: string;
}

const ALLOWED_TYPES = [
  "application/pdf",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/plain",
];

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export async function saveMaterialFile(
  file: File,
  seminarId: string,
  speakerName: string = "",
): Promise<MaterialFile> {
  // Check file type
  if (!ALLOWED_TYPES.includes(file.type) && file.type !== "") {
    throw new Error(
      `Tipe file tidak didukung: ${file.type}. Gunakan PDF, PPT, DOC, Excel, atau gambar.`,
    );
  }

  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(
      `File terlalu besar (max 50MB). Ukuran file: ${(file.size / 1024 / 1024).toFixed(1)}MB`,
    );
  }

  const id = Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
  const ext = file.name.split(".").pop() || "bin";
  const fileName = `${seminarId}-${id}.${ext}`;
  const relativeDir = path.join("uploads", "materials");
  const absoluteDir = path.resolve("public", relativeDir);
  const absolutePath = path.join(absoluteDir, fileName);

  await mkdir(absoluteDir, { recursive: true });

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(absolutePath, buffer);

  return {
    id,
    name: fileName,
    originalName: file.name,
    url: `/${relativeDir}/${fileName}`,
    size: file.size,
    type: file.type || "application/octet-stream",
    speakerName,
    uploadedAt: new Date().toISOString(),
  };
}

export async function deleteMaterialFile(
  material: MaterialFile,
): Promise<void> {
  const absolutePath = path.resolve("public", material.url.replace(/^\//, ""));
  try {
    await unlink(absolutePath);
  } catch {
    // File might not exist, ignore
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export function getFileIcon(type: string): string {
  if (type.includes("pdf")) return "📄";
  if (type.includes("presentation") || type.includes("powerpoint")) return "📽️";
  if (type.includes("word") || type.includes("document")) return "📝";
  if (type.includes("excel") || type.includes("spreadsheet")) return "📊";
  if (type.includes("image")) return "🖼️";
  if (type.includes("text")) return "📃";
  return "📁";
}
