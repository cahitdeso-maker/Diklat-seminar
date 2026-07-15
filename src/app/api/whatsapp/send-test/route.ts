import { NextRequest, NextResponse } from "next/server";
import { sendWhatsAppMessage } from "@/lib/wa-gateway";
import { formatPhoneNumber } from "@/lib/whatsapp";

export async function POST(req: NextRequest) {
  try {
    const { number, message } = await req.json();

    if (!number || !message) {
      return NextResponse.json(
        { success: false, message: "Nomor dan pesan harus diisi" },
        { status: 400 },
      );
    }

    const formattedNumber = formatPhoneNumber(number);
    const result = await sendWhatsAppMessage(formattedNumber, message);

    if (!result.success) {
      return NextResponse.json(
        { success: false, message: result.message || "Gagal mengirim pesan" },
        { status: 502 },
      );
    }

    return NextResponse.json({
      success: true,
      message: `Pesan berhasil dikirim ke ${formattedNumber}`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: `Error: ${error.message}` },
      { status: 500 },
    );
  }
}
