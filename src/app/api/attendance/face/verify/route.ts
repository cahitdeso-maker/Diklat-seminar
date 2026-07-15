import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { registrations, attendance, certificates, seminars, faceEmbeddings } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { SimilarityService } from "@/services/SimilarityService";
import { generateCertificateNumber } from "@/lib/certificate-number";

/**
 * Face Verify API - Compares captured face descriptor with stored descriptors.
 *
 * This endpoint receives a face descriptor (128D array from face-api.js FaceNet),
 * fetches all registrations with stored descriptors (from face_embeddings table),
 * and computes Euclidean distance to find the best match.
 *
 * Threshold: distance < 0.5 is considered the same person.
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

    // Get all registrations that haven't checked in, along with their face embeddings
    const results = await db
      .select({
        registration: registrations,
        embeddingRecord: faceEmbeddings,
      })
      .from(faceEmbeddings)
      .innerJoin(registrations, eq(faceEmbeddings.registrationId, registrations.id))
      .where(
        and(
          eq(registrations.isPresent, false),
          eq(registrations.isDeleted, false)
        )
      );

    if (results.length === 0) {
      return NextResponse.json(
        { error: "Tidak ada peserta dengan data Face ID. Silakan daftar dengan Face ID terlebih dahulu." },
        { status: 404 }
      );
    }

    // Compare captured embedding against all stored embeddings using Euclidean distance
    let bestMatch: {
      registration: typeof results[0]['registration'];
      distance: number;
      similarity: number;
      match: boolean;
    } | null = null;

    for (const row of results) {
      try {
        const storedEmbedding = JSON.parse(row.embeddingRecord.descriptor);
        if (!Array.isArray(storedEmbedding)) continue;

        const result = SimilarityService.compare(storedEmbedding, embedding);

        if (!bestMatch || result.distance < bestMatch.distance) {
          bestMatch = { registration: row.registration, ...result };
        }
      } catch {
        // Skip invalid embeddings
        continue;
      }
    }

    // Check if any match was found
    const THRESHOLD = SimilarityService.getDefaultThreshold();
    if (!bestMatch) {
      return NextResponse.json(
        {
          match: false,
          error: "Tidak ada embedding wajah yang cocok ditemukan",
        },
        { status: 200 }
      );
    }

    // Check if best match meets Euclidean distance threshold (< 0.5 = match)
    if (!bestMatch.match) {
      return NextResponse.json(
        {
          match: false,
          distance: bestMatch.distance,
          similarity: bestMatch.similarity,
          error: `Wajah tidak cocok (jarak: ${bestMatch.distance.toFixed(2)}, minimal jarak: ${THRESHOLD})`,
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

