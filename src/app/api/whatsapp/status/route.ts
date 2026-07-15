import { NextResponse } from "next/server";
import { getWhatsAppStatus } from "@/lib/wa-gateway";

export async function GET() {
  const result = await getWhatsAppStatus();

  if (!result.success) {
    return NextResponse.json(
      {
        connected: false,
        status: "disconnected",
        error: result.message,
        user: null,
        queue: { pending: 0, inProgress: 0 },
      },
      { status: 200 },
    );
  }

  return NextResponse.json({
    connected: result.data?.wa?.connected || false,
    status: result.data?.wa?.status || "disconnected",
    hasQr: result.data?.wa?.hasQr || false,
    user: result.data?.wa?.user || null,
    queue: result.data?.queue || { pending: 0, inProgress: 0 },
    timestamp: new Date().toISOString(),
  });
}
