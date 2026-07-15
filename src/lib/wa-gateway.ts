/**
 * WA Gateway Service Helper
 *
 * Server-side helper untuk berkomunikasi dengan wa-gateway Baileys
 * yang berjalan di http://192.168.12.72:3000
 */

const WA_GATEWAY_URL = process.env.WA_GATEWAY_URL || "http://192.168.12.72:3000";
const WA_GATEWAY_SECRET = process.env.WA_GATEWAY_SECRET || "wa-gateway-key-2024-presensi-medis";

interface WaGatewayResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
}

async function callGateway<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<WaGatewayResponse<T>> {
  try {
    const url = `${WA_GATEWAY_URL}${endpoint}`;
    const res = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": WA_GATEWAY_SECRET,
        ...options.headers,
      },
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => "Unknown error");
      return {
        success: false,
        message: `Gateway error (${res.status}): ${errorText}`,
      };
    }

    const data = await res.json();
    return { success: true, data };
  } catch (error: any) {
    return {
      success: false,
      message: `Gagal terhubung ke wa-gateway: ${error.message}`,
    };
  }
}

/**
 * Mendapatkan status koneksi WhatsApp
 */
export async function getWhatsAppStatus() {
  return callGateway<{
    wa: {
      status: string;
      connected: boolean;
      hasQr: boolean;
      user: { id: string; name: string; number: string } | null;
    };
    queue: {
      pending: number;
      inProgress: number;
    };
  }>("/status");
}

/**
 * Mendapatkan QR code untuk pairing (base64 data URL)
 */
export async function getWhatsAppQr() {
  return callGateway<{
    qr: string | null;
    qrString?: string;
    message: string;
    status: string;
  }>("/qr");
}

/**
 * Mengirim pesan WhatsApp
 */
export async function sendWhatsAppMessage(number: string, message: string) {
  return callGateway<{ messageId?: string }>("/send-message", {
    method: "POST",
    body: JSON.stringify({ number, message }),
  });
}

/**
 * Logout dari WhatsApp
 */
export async function logoutWhatsApp() {
  return callGateway<{ message: string }>("/logout", {
    method: "POST",
  });
}
