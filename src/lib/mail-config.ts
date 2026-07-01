/**
 * Konfigurasi Pengiriman Sertifikat
 *
 * 👉 Isi sesuai dengan SMTP email / API WhatsApp yang Anda miliki.
 *
 * CARA PENGGUNAAN:
 * 1. Isi EMAIL_CONFIG jika punya SMTP email
 * 2. Isi WHATSAPP_CONFIG jika punya API WhatsApp
 * 3. Aktifkan method yang diinginkan (email / whatsapp)
 */

export const EMAIL_CONFIG = {
  enabled: false, // Ubah ke true jika sudah punya SMTP
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  user: "email-anda@gmail.com",
  password: "password-aplikasi",
  fromName: "RS PKU Muhammadiyah Gombong - Diklat",
  fromEmail: "diklat@pkugombong.com",
};

export const WHATSAPP_CONFIG = {
  enabled: false, // Ubah ke true jika sudah punya API WA
  apiUrl: "https://api.whatsapp.com/send",
  apiKey: "API_KEY_ANDA",
  senderNumber: "628XXXXXXXXXX",
};

export async function sendCertificateViaEmail(
  toEmail: string,
  participantName: string,
  seminarTitle: string,
  certificateUrl?: string,
): Promise<boolean> {
  if (!EMAIL_CONFIG.enabled) {
    console.log(`📧 [EMAIL SIMULASI] Ke: ${toEmail}`);
    console.log(`   Subjek: Sertifikat ${seminarTitle}`);
    console.log(`   Hai ${participantName}, sertifikat Anda siap!`);
    console.log(`   Link: ${certificateUrl || "Akan di-generate"}`);
    return true;
  }

  // TODO: Implementasi SMTP mailer
  // const nodemailer = await import("nodemailer");
  // const transporter = nodemailer.createTransport({ ... });
  // await transporter.sendMail({ ... });

  return true;
}

export async function sendCertificateViaWhatsApp(
  phoneNumber: string,
  participantName: string,
  seminarTitle: string,
  certificateUrl?: string,
): Promise<boolean> {
  if (!WHATSAPP_CONFIG.enabled) {
    console.log(`💬 [WA SIMULASI] Ke: ${phoneNumber}`);
    console.log(`   Pesan: Hai ${participantName}, sertifikat ${seminarTitle}`);
    console.log(`   Link: ${certificateUrl || "Akan di-generate"}`);
    return true;
  }

  // TODO: Implementasi WhatsApp API
  // const res = await fetch(WHATSAPP_CONFIG.apiUrl, { ... });

  return true;
}
