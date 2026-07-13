import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { registrations, attendance, certificates, seminars } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { SimilarityService } from "@/services/SimilarityService";
import { generateCertificateNumber } from "@/lib/certificate-number";

/**
 * Face Verify API - Compares captured face embedding with stored embeddings.
 *
 * This endpoint receives a face embedding from the client (generated via MobileFaceNet ONNX),
 * fetches all registrations with stored embeddings, and computes cosine similarity
 * to find the best match.
 *
 * Threshold: >= 0.90 (90%) is considered the same person.
 */
export async function POST(req: NextRequest) {
  try {
    const { embedding } = await req.json();

    if (!embedding || !Array.isArray(embedding) || embedding.length === 0) {
      return NextResponse.json(
        { error: "Embedding wajah harus diisi" },
        { status: 400 }
      );
    }

    // Get all registrations that have face embeddings and haven't checked in
    const regs = await db
      .select()
      .from(registrations)
      .where(
        and(
          eq(registrations.isPresent, false),
          eq(registrations.isDeleted, false)
        )
      );

    if (regs.length === 0) {
      return NextResponse.json(
        { error: "Tidak ada peserta yang belum hadir" },
        { status: 404 }
      );
    }

    // Filter registrations that have face embeddings
    const withEmbedding = regs.filter((r) => r.faceEmbedding);

    if (withEmbedding.length === 0) {
      return NextResponse.json(
        { error: "Tidak ada peserta dengan data Face ID. Silakan daftar dengan Face ID terlebih dahulu." },
        { status: 404 }
      );
    }

    // Compute cosine similarity with all stored embeddings
    let bestMatch: { registration: typeof withEmbedding[0]; similarity: number } | null = null;

    for (const reg of withEmbedding) {
      try {
        const storedEmbedding = JSON.parse(reg.faceEmbedding!);
        if (!Array.isArray(storedEmbedding)) continue;

        const { similarity } = SimilarityService.compare(storedEmbedding, embedding);

        if (!bestMatch || similarity > bestMatch.similarity) {
          bestMatch = { registration: reg, similarity };
        }
      } catch {
        // Skip invalid embeddings
        continue;
      }
    }

    // Check if best match meets threshold
    const THRESHOLD = 0.90;
    const bestSimilarity = bestMatch?.similarity ?? 0;
    if (!bestMatch || bestSimilarity < THRESHOLD) {
      const topScore = Math.round(bestSimilarity * 100);
      return NextResponse.json(
        {
          match: false,
          similarity: bestSimilarity,
          error: `Wajah tidak cocok (similarity: ${topScore}%, minimal: ${THRESHOLD * 100}%)`,
        },
        { status: 200 }
      );
    }

    // Mark as present
    const matchedReg = bestMatch.registration;
    
    // Generate certificate number (auto-generate saat presensi)
    let certResult = null;
    try {
      certResult = await generateCertificateNumber(matchedReg.id, matchedReg.seminarId);
    } catch (certErr) {
      console.warn("Certificate number generation skipped:", certErr);
    }

    await db
      .update(registrations)
      .set({
        isPresent: true,
        presentTime: new Date(),
        presentMethod: "face",
      })
      .where(eq(registrations.id, matchedReg.id));

    // Ambil data seminar untuk title
    const [seminarData] = await db
      .select({ title: seminars.title })
      .from(seminars)
      .where(eq(seminars.id, matchedReg.seminarId))
      .limit(1);

    // Simpan record ke tabel certificates jika nomor berhasil digenerate
    if (certResult) {
      await db.insert(certificates).values({
        id: uuidv4(),
        userId: matchedReg.id,
        title: seminarData?.title || "Sertifikat Seminar",
        certificateNumber: certResult.code,
        fileUrl: null,
        generatedDate: new Date(),
        isDeleted: false,
      });
    }

    // Create attendance record
    await db.insert(attendance).values({
      id: uuidv4(),
      registrationId: matchedReg.id,
      method: "face",
      timestamp: new Date(),
    });

    return NextResponse.json({
      success: true,
      match: true,
      similarity: bestMatch.similarity,
      participant: {
        id: matchedReg.id,
        fullName: matchedReg.fullName,
        email: matchedReg.email,
        phoneNumber: matchedReg.phoneNumber,
        institution: matchedReg.institution,
        profession: matchedReg.profession,
        qrCode: matchedReg.qrCode,
        certificateNumber: certResult?.code || null,
      },
    });
  } catch (error) {
    console.error("Face verify error:", error);
    return NextResponse.json(
      { error: "Gagal memverifikasi wajah" },
      { status: 500 }
    );
  }
}

