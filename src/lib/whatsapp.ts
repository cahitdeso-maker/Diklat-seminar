/**
 * WhatsApp Service
 *
 * Mengirim pesan WhatsApp melalui server Baileys di http://192.168.12.72:3000
 */

const WA_GATEWAY_URL = process.env.WA_GATEWAY_URL || "http://192.168.12.72:3000";
const WA_GATEWAY_SECRET = process.env.WA_GATEWAY_SECRET || "wa-gateway-key-2024-presensi-medis";

const WHATSAPP_API_URL = `${WA_GATEWAY_URL}/send-message`;

export interface WhatsAppResponse {
  success: boolean;
  message: string;
}

export async function sendMessage(
  phoneNumber: string,
  message: string,
): Promise<WhatsAppResponse> {
  try {
    const res = await fetch(WHATSAPP_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": WA_GATEWAY_SECRET,
      },
      body: JSON.stringify({
        number: phoneNumber,
        message,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => "Unknown error");
      console.error(`WhatsApp API error (${res.status}): ${errorText}`);
      return {
        success: false,
        message: `Gagal mengirim pesan (HTTP ${res.status})`,
      };
    }

    const data = await res.json();
    return {
      success: data.success === true,
      message: data.message || "Pesan berhasil dikirim",
    };
  } catch (error) {
    console.error("WhatsApp connection error:", error);
    return {
      success: false,
      message:
        "Gagal terhubung ke server WhatsApp. Pastikan server di 192.168.12.72:3000 aktif.",
    };
  }
}

/**
 * Format nomor telepon ke format internasional (628xx)
 * Menghapus karakter non-digit dan memastikan diawali 62
 */
export function formatPhoneNumber(phone: string): string {
  // Hapus semua karakter non-digit
  let cleaned = phone.replace(/\D/g, "");

  // Jika diawali 0, ganti dengan 62
  if (cleaned.startsWith("0")) {
    cleaned = "62" + cleaned.slice(1);
  }

  // Jika tidak diawali 62, tambahkan 62
  if (!cleaned.startsWith("62")) {
    cleaned = "62" + cleaned;
  }

  return cleaned;
}

export function buildCertificateMessage(
  participantName: string,
  seminarTitle: string,
  seminarDate: string,
  certificateNumber?: string,
): string {
  const certLine = certificateNumber ? `\nNo. Sertifikat: ${certificateNumber}` : "";
  return `🎓 *SERTIFIKAT SEMINAR*
    
Yth. ${participantName},

Terima kasih telah mengikuti seminar:
*${seminarTitle}*
Tanggal: ${seminarDate}${certLine}

Sertifikat Anda telah diterbitkan.
Untuk mengunduh sertifikat, silakan hubungi panitia Diklat RS PKU Muhammadiyah Gombong.

Terima kasih.
_Bagian Diklat RS PKU Muhammadiyah Gombong_`;
}

export async function sendCertificate(
  phoneNumber: string,
  participantName: string,
  seminarTitle: string,
  seminarDate: string,
  certificateNumber?: string,
): Promise<WhatsAppResponse> {
  const formattedNumber = formatPhoneNumber(phoneNumber);
  const message = buildCertificateMessage(
    participantName,
    seminarTitle,
    seminarDate,
    certificateNumber,
  );

  console.log(`📤 Sending certificate WhatsApp to ${formattedNumber}...`);

  const result = await sendMessage(formattedNumber, message);

  if (result.success) {
    console.log(`✅ Certificate WhatsApp sent to ${formattedNumber}`);
  } else {
    console.error(`❌ Failed to send certificate WhatsApp: ${result.message}`);
  }

  return result;
}
