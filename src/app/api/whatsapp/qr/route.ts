import { NextResponse } from "next/server";
import { getWhatsAppQr, getWhatsAppStatus } from "@/lib/wa-gateway";

export async function GET() {
  // Cek status dulu
  const statusResult = await getWhatsAppStatus();

  if (statusResult.success && statusResult.data?.wa?.connected) {
    return NextResponse.json({
      success: true,
      qr: null,
      message: "WhatsApp sudah terhubung, tidak perlu scan QR",
      status: "connected",
      user: statusResult.data.wa.user,
    });
  }

  // Ambil QR code
  const result = await getWhatsAppQr();

  if (!result.success) {
    return NextResponse.json(
      {
        success: false,
        qr: null,
        message: result.message || "Gagal mendapatkan QR code",
        status: "error",
      },
      { status: 200 },
    );
  }

  return NextResponse.json({
    success: true,
    qr: result.data?.qr || null,
    qrString: result.data?.qrString || null,
    message: result.data?.message || "QR code siap",
    status: result.data?.status || "qr_required",
  });
}
