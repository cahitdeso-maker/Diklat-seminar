import { NextResponse } from "next/server";
import { logoutWhatsApp } from "@/lib/wa-gateway";

export async function POST() {
  try {
    const result = await logoutWhatsApp();

    if (!result.success) {
      return NextResponse.json(
        { success: false, message: result.message || "Gagal logout" },
        { status: 502 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Session WhatsApp berhasil dihapus. Scan QR ulang untuk menghubungkan kembali.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: `Error: ${error.message}` },
      { status: 500 },
    );
  }
}
