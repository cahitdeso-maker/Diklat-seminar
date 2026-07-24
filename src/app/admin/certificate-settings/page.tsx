"use client";

import { useState, useEffect } from "react";

interface Settings {
  id: string;
  letterPrefix: string;
  institutionCode: string;
  letterType: string;
  unitCode: string;
  classification: string;
  month: string;
  nextCertificateNumber: number;
  computedNextNumber: number;
  lastCertificateNumber: number;
  year: string;
  format: string;
  participantName: string;
  resetOption: "per_seminar" | "per_tahun" | "never";
}

const MONTHS_ROMAN = [
  "I", "II", "III", "IV", "V", "VI",
  "VII", "VIII", "IX", "X", "XI", "XII",
];

function getCombinedCode(settings: Settings): string {
  return `${settings.letterType || "KET"}/${settings.unitCode || "IV.6.AU"}/${settings.classification || "A"}`;
}

function generateCode(settings: Settings, num: number): string {
  const monthRoman = settings.month || MONTHS_ROMAN[new Date().getMonth()];
  const combinedCode = getCombinedCode(settings);
  const format = "{nomor}/{kode}/{bulan}/{tahun}";
  let code = format
    .replace("{nomor}", String(num).padStart(2, "0"))
    .replace("{kode}", combinedCode)
    .replace("{bulan}", monthRoman)
    .replace("{tahun}", settings.year);
  return `NO : ${code}`;
}

export default function CertificateSettingsPage() {
  const [settings, setSettings] = useState<Settings | null>({
    letterPrefix: "NO : ",
    participantName: "",
    format: "{nomor}/{kode}/{bulan}/{tahun}",
    institutionCode: "KET/IV.6.AU/A",
    letterType: "KET",
    unitCode: "IV.6.AU",
    classification: "A",
    month: MONTHS_ROMAN[new Date().getMonth()],
    nextCertificateNumber: 1,
    computedNextNumber: 1,
    lastCertificateNumber: 0,
    year: String(new Date().getFullYear()),
    resetOption: "per_tahun" as const,
  } as Settings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const currentMonthRoman = MONTHS_ROMAN[new Date().getMonth()];

  useEffect(() => {
    fetch("/api/certificate-settings")
      .then((r) => r.ok && r.json())
      .then((d) => {
        if (d) {
          d.letterPrefix = d.letterPrefix || "NO : ";
          d.participantName = d.participantName || "";
          d.computedNextNumber = d.computedNextNumber ?? d.nextCertificateNumber ?? 1;
          d.nextCertificateNumber = d.computedNextNumber;
          d.lastCertificateNumber = d.lastCertificateNumber ?? 0;
          d.resetOption = d.resetOption || "per_tahun";
          d.letterType = d.letterType || "KET";
          d.unitCode = d.unitCode || "IV.6.AU";
          d.classification = d.classification || "A";
          d.month = d.month || MONTHS_ROMAN[new Date().getMonth()];
          setSettings(d);
        }
        setLoading(false);
      })
      .catch(() => {
        setMessage("Gagal memuat pengaturan");
        setLoading(false);
      });
  }, []);

  const update = async () => {
    if (!settings) return;
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/certificate-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          letterType: settings.letterType,
          unitCode: settings.unitCode,
          classification: settings.classification,
          format: "{nomor}/{kode}/{bulan}/{tahun}",
          year: settings.year,
          month: settings.month,
          nextCertificateNumber: settings.nextCertificateNumber,
          resetOption: settings.resetOption,
        }),
      });
      if (res.ok) {
        const updatedSettings = await res.json();
        updatedSettings.nextCertificateNumber = updatedSettings.computedNextNumber;
        setSettings(updatedSettings);
        setMessage("✅ Pengaturan berhasil disimpan");
      } else {
        setMessage("❌ Gagal menyimpan");
      }
    } catch {
      setMessage("❌ Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="animate-spin w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
        </div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="p-6">
        <div className="text-center py-12 text-slate-400">
          Pengaturan tidak ditemukan
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Pengaturan Nomor Sertifikat
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Atur format dan penomoran sertifikat peserta
        </p>
      </div>

      {message && (
        <div
          className={`mb-6 px-5 py-4 rounded-xl text-sm ${
            message.startsWith("❌")
              ? "bg-red-50 border border-red-200 text-red-700"
              : "bg-green-50 border border-green-200 text-green-700"
          }`}
        >
          {message}
        </div>
      )}

      {/* Settings Form */}
      <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 p-6 space-y-5">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shadow-lg shadow-blue-200">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Konfigurasi Nomor</h2>
            <p className="text-xs text-gray-500">Atur penomoran sertifikat peserta</p>
          </div>
        </div>

        {/* Info Nomor Terakhir & Berikutnya */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl p-4 border border-emerald-200">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
              <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">Nomor Terakhir</p>
            </div>
            <p className="text-2xl font-bold text-emerald-800 font-mono">
              {settings.lastCertificateNumber > 0
                ? String(settings.lastCertificateNumber).padStart(2, "0")
                : "—"}
            </p>
            <p className="text-xs text-emerald-600 mt-1">
              {settings.lastCertificateNumber > 0
                ? generateCode(settings, settings.lastCertificateNumber)
                : "Belum ada sertifikat terbit"}
            </p>
          </div>

          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-200">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-blue-500"></div>
              <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Akan Terbit</p>
            </div>
            <p className="text-2xl font-bold text-blue-800 font-mono">
              {String(settings.computedNextNumber).padStart(2, "0")}
            </p>
            <p className="text-xs text-blue-600 mt-1">
              {generateCode(settings, settings.computedNextNumber)}
            </p>
            {settings.nextCertificateNumber !== settings.computedNextNumber && (
              <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                <span>⚠️</span>
                <span>Konfigurasi mulai dari <strong>{settings.nextCertificateNumber}</strong>, tapi <strong>{settings.computedNextNumber}</strong> akan terbit karena nomor sebelumnya sudah ada.</span>
              </p>
            )}
          </div>
        </div>

        {/* 6 Komponen Utama */}
        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-4">
          {/* 1. Mulai Dari Nomor */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Mulai Dari Nomor</label>
            <div className="relative">
              <input
                type="number"
                min="1"
                value={settings.nextCertificateNumber}
                onChange={(e) =>
                  setSettings({ ...settings, nextCertificateNumber: parseInt(e.target.value) || 1 })
                }
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:border-blue-400 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
          </div>

          {/* 2. Jenis Surat */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Jenis Surat</label>
            <input
              type="text"
              value={settings.letterType}
              onChange={(e) => setSettings({ ...settings, letterType: e.target.value })}
              placeholder="KET"
              className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:border-blue-400 outline-none"
            />
          </div>

          {/* 3. Kode Unit */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Kode Unit</label>
            <input
              type="text"
              value={settings.unitCode}
              onChange={(e) => setSettings({ ...settings, unitCode: e.target.value })}
              placeholder="IV.6.AU"
              className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:border-blue-400 outline-none"
            />
          </div>

          {/* 4. Klasifikasi */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Klasifikasi</label>
            <input
              type="text"
              value={settings.classification}
              onChange={(e) => setSettings({ ...settings, classification: e.target.value })}
              placeholder="A"
              className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:border-blue-400 outline-none"
            />
          </div>

          {/* 5. Bulan */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Bulan</label>
            <input
              type="text"
              value={settings.month || currentMonthRoman}
              onChange={(e) => setSettings({ ...settings, month: e.target.value })}
              placeholder={currentMonthRoman}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:border-blue-400 outline-none"
            />
          </div>

          {/* 6. Tahun */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Tahun</label>
            <input
              type="text"
              value={settings.year}
              onChange={(e) => setSettings({ ...settings, year: e.target.value })}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:border-blue-400 outline-none"
            />
          </div>
        </div>

        {/* Hasil Akhir Preview */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-5 border border-blue-200">
          <p className="text-xs font-semibold text-blue-600 mb-2">Hasil Akhir</p>
          <p className="text-xl font-bold text-blue-800 font-mono tracking-wide">
            {generateCode(settings, settings.nextCertificateNumber || 1)}
          </p>
        </div>

        <button
          onClick={update}
          disabled={saving}
          className="w-full px-4 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-all shadow-lg disabled:opacity-50 text-sm"
        >
          {saving ? "Menyimpan..." : "Simpan Pengaturan"}
        </button>
      </div>
    </div>
  );
}