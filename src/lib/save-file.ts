import { writeFile, mkdir } from "fs/promises";
import path from "path";

/**
 * Save a base64 data URL to the public/uploads directory.
 * Returns the public URL path to access the file.
 */
export async function saveBase64File(
  dataUrl: string,
  studentId: string,
  prefix: string = "face",
): Promise<string> {
  // Validate base64 data URL
  if (!dataUrl || !dataUrl.startsWith("data:")) {
    throw new Error("Invalid data URL");
  }

  // Extract mime type and base64 data
  const matches = dataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) {
    throw new Error("Invalid base64 data URL format");
  }

  const mimeType = matches[1];
  const base64Data = matches[2];

  // Determine file extension from mime type
  const extensionMap: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };
  const ext = extensionMap[mimeType] || "jpg";

  // Create buffer from base64
  const buffer = Buffer.from(base64Data, "base64");

  // Build file path
  const fileName = `${prefix}-${studentId}.${ext}`;
  const relativeDir = path.join("public", "uploads", "faces");
  const absoluteDir = path.resolve(relativeDir);
  const absolutePath = path.join(absoluteDir, fileName);

  // Ensure directory exists
  await mkdir(absoluteDir, { recursive: true });

  // Write file
  await writeFile(absolutePath, buffer);

  // Return public URL path
  return `/uploads/faces/${fileName}`;
}

/**
 * Delete a saved file by its public URL path.
 */
export async function deleteSavedFile(publicUrl: string): Promise<void> {
  if (!publicUrl || !publicUrl.startsWith("/uploads/")) return;

  const absolutePath = path.resolve(path.join("public", publicUrl));
  const { unlink } = await import("fs/promises");
  try {
    await unlink(absolutePath);
  } catch {
    // File might not exist, ignore
  }
}
