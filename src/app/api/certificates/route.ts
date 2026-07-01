import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { certificates, certificateTemplates, users } from "@/lib/schema";
import { generateId } from "@/lib/utils";
import { eq } from "drizzle-orm";
import fs from "fs";
import path from "path";

export async function POST(request: Request) {
  try {
    const { userId, templateId, title, issuanceDate } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: "User ID harus diisi" },
        { status: 400 },
      );
    }

    const [student] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!student) {
      return NextResponse.json(
        { error: "Mahasiswa tidak ditemukan" },
        { status: 404 },
      );
    }

    let template = null;
    if (templateId) {
      [template] = await db
        .select()
        .from(certificateTemplates)
        .where(eq(certificateTemplates.id, templateId))
        .limit(1);
    } else {
      [template] = await db
        .select()
        .from(certificateTemplates)
        .where(eq(certificateTemplates.isActive, true))
        .limit(1);
    }

    const certId = generateId();
    const certTitle = title || "Sertifikat Praktik";
    const date = issuanceDate || new Date().toISOString().split("T")[0];

    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF("landscape", "mm", "a4");

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    doc.setFillColor(245, 247, 250);
    doc.rect(0, 0, pageWidth, pageHeight, "F");

    doc.setDrawColor(41, 128, 185);
    doc.setLineWidth(3);
    doc.rect(10, 10, pageWidth - 20, pageHeight - 20);

    doc.setDrawColor(52, 152, 219);
    doc.setLineWidth(1);
    doc.rect(15, 15, pageWidth - 30, pageHeight - 30);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(36);
    doc.setTextColor(41, 128, 185);
    doc.text(certTitle, pageWidth / 2, 60, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(16);
    doc.setTextColor(100, 100, 100);
    doc.text("Diberikan kepada:", pageWidth / 2, 90, { align: "center" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(28);
    doc.setTextColor(44, 62, 80);
    doc.text(student.fullName, pageWidth / 2, 115, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(14);
    doc.setTextColor(80, 80, 80);

    const details = [
      student.schoolOrigin ? `Dari: ${student.schoolOrigin}` : null,
      `Tanggal Penerbitan: ${date}`,
    ].filter(Boolean);

    let yPos = 140;
    for (const detail of details) {
      doc.text(detail!, pageWidth / 2, yPos, { align: "center" });
      yPos += 12;
    }

    doc.setFontSize(12);
    doc.setTextColor(120, 120, 120);
    doc.text(
      "Telah melaksanakan praktik dengan baik",
      pageWidth / 2,
      yPos + 20,
      { align: "center" },
    );

    doc.setFont("helvetica", "italic");
    doc.setFontSize(10);
    doc.setTextColor(150, 150, 150);
    doc.text(
      "Presensi Medis Pintar - Bagian Diklat Rumah Sakit",
      pageWidth / 2,
      pageHeight - 25,
      { align: "center" },
    );

    const certDir = path.join(
      process.cwd(),
      "public",
      "uploads",
      "certificates",
    );
    if (!fs.existsSync(certDir)) {
      fs.mkdirSync(certDir, { recursive: true });
    }

    const fileName = `${certId}.pdf`;
    const filePath = path.join(certDir, fileName);
    doc.save(filePath);

    const fileUrl = `/uploads/certificates/${fileName}`;

    await db.insert(certificates).values({
      id: certId,
      userId,
      templateId: template?.id || null,
      title: certTitle,
      issuanceDate: date,
      fileUrl,
      generatedDate: new Date(),
    });

    return NextResponse.json({
      success: true,
      message: "Sertifikat berhasil dibuat",
      certificate: { id: certId, fileUrl },
    });
  } catch (error) {
    console.error("Certificate creation error:", error);
    return NextResponse.json(
      { error: "Gagal membuat sertifikat" },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    let results;
    if (userId) {
      results = await db
        .select()
        .from(certificates)
        .where(eq(certificates.userId, userId));
    } else {
      results = await db.select().from(certificates);
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error("Get certificates error:", error);
    return NextResponse.json(
      { error: "Gagal mengambil data sertifikat" },
      { status: 500 },
    );
  }
}
