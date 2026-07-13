"use client";

import { useState, useEffect } from "react";

interface Settings {
  id: string;
  letterPrefix: string;
  institutionCode: string;
  letterType: string;
  unitCode: string;
  classification: string;
  nextCertificateNumber: number;
  lastCertificateNumber: number;
  year: string;
  format: string;
  participantName: string;
  resetOption: "per_seminar" | "per_tahun" | "never";
}

interface Seminar {
  id: string;
  title: string;
  date: string;
}

interface Participant {
  id: string;
  fullName: string;
  phoneNumber: string | null;
  email: string | null;
  institution: string | null;
  profession: string | null;
  presentTime: string | null;
  certificateSent: boolean;
  certificateCode: string | null;
  certificateNumber: number | null;
}

const MONTHS_ROMAN = [
  "I", "II", "III", "IV", "V", "VI",
  "VII", "VIII", "IX", "X", "XI", "XII",
];

function getCombinedCode(settings: Settings): string {
  return `${settings.letterType || "KET"}/${settings.unitCode || "IV.6.AU"}/${settings.classification || "A"}`;
}

function generateCode(settings: Settings, num: number): string {
  const monthRoman = MONTHS_ROMAN[new Date().getMonth()];
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
    format: "{nomor} {kode}/{bulan}/{tahun}",
    institutionCode: "KET/IV.6.AU/A",
    letterType: "KET",
    unitCode: "IV.6.AU",
    classification: "A",
    nextCertificateNumber: 1,
    lastCertificateNumber: 0,
    year: String(new Date().getFullYear()),
    resetOption: "per_tahun" as const,
  } as Settings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  // Edit modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingParticipant, setEditingParticipant] = useState<Participant | null>(null);
  const [editNumber, setEditNumber] = useState(1);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState("");

  // Seminar & participants
  const [seminars, setSeminars] = useState<Seminar[]>([]);
  const [selectedSeminarId, setSelectedSeminarId] = useState("");
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loadingParticipants, setLoadingParticipants] = useState(false);

  const currentMonthRoman = MONTHS_ROMAN[new Date().getMonth()];

  useEffect(() => {
    fetch("/api/certificate-settings")
      .then((r) => r.ok && r.json())
      .then((d) => {
        if (d) {
          d.letterPrefix = d.letterPrefix || "NO : ";
          d.participantName = d.participantName || "";
          d.nextCertificateNumber = d.nextCertificateNumber ?? 1;
          d.lastCertificateNumber = d.lastCertificateNumber ?? 0;
          d.resetOption = d.resetOption || "per_tahun";
          d.letterType = d.letterType || "KET";
          d.unitCode = d.unitCode || "IV.6.AU";
          d.classification = d.classification || "A";
          setSettings(d);
        }
        setLoading(false);
      })
      .catch(() => {
        setMessage("Gagal memuat pengaturan");
        setLoading(false);
      });
  }, []);

  // Helper untuk refresh settings dari server
  const refreshSettings = async () => {
    try {
      const res = await fetch("/api/certificate-settings");
      if (res.ok) {
        const d = await res.json();
        if (d) {
          d.letterPrefix = d.letterPrefix || "NO : ";
          d.participantName = d.participantName || "";
          d.nextCertificateNumber = d.nextCertificateNumber ?? 1;
          d.lastCertificateNumber = d.lastCertificateNumber ?? 0;
          d.resetOption = d.resetOption || "per_tahun";
          d.letterType = d.letterType || "KET";
          d.unitCode = d.unitCode || "IV.6.AU";
          d.classification = d.classification || "A";
          setSettings(d);
        }
      }
    } catch {
      // silent
    }
  };

  // Load seminars for dropdown
  useEffect(() => {
    fetch("/api/seminars?active=false")
      .then((r) => r.ok && r.json())
      .then((d) => setSeminars(d || []));
  }, []);

  const loadAttendedParticipants = async (seminarId: string) => {
    setLoadingParticipants(true);
    setMessage("");
    try {
      const res = await fetch(`/api/attended-participants?seminarId=${seminarId}`);
      if (res.ok) {
        const data = await res.json();
        setParticipants(data.participants || []);
      } else {
        setMessage("Gagal memuat data peserta hadir");
      }
    } catch {
      setMessage("❌ Gagal terhubung ke server");
    } finally {
      setLoadingParticipants(false);
    }
  };

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
          format: "{nomor} {kode}/{bulan}/{tahun}",
          year: settings.year,
          nextCertificateNumber: settings.nextCertificateNumber,
          resetOption: settings.resetOption,
        }),
      });
      if (res.ok) {
        const updatedSettings = await res.json();
        setSettings(updatedSettings);
        setMessage("✅ Pengaturan berhasil disimpan");
        // Refresh data peserta jika seminar sedang dipilih
        if (selectedSeminarId) {
          loadAttendedParticipants(selectedSeminarId);
        }
      } else {
        setMessage("❌ Gagal menyimpan");
      }
    } catch {
      setMessage("❌ Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

  const saveCertificateNumber = async () => {
    if (!editingParticipant || !selectedSeminarId) return;
    setEditLoading(true);
    setEditError("");
    try {
      const res = await fetch(`/api/registrations?id=${editingParticipant.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          certificateNumber: editNumber,
          seminarId: selectedSeminarId,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setEditModalOpen(false);
        setEditingParticipant(null);
        setMessage("✅ Nomor sertifikat berhasil diperbarui");
        // Refresh settings dari server agar nextCertificateNumber selalu sinkron
        await refreshSettings();
        loadAttendedParticipants(selectedSeminarId);
      } else {
        setEditError(data.error || "Gagal mengupdate nomor sertifikat");
      }
    } catch {
      setEditError("❌ Gagal terhubung ke server");
    } finally {
      setEditLoading(false);
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

      {/* Participants Preview */}
      <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 p-6 space-y-5 mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Peserta yang Sudah Presensi</h2>
        
        <div className="mb-4">
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Pilih Seminar
          </label>
          <select
            value={selectedSeminarId}
            onChange={(e) => {
              setSelectedSeminarId(e.target.value);
              if (e.target.value) loadAttendedParticipants(e.target.value);
            }}
            className="w-full max-w-md px-4 py-3 border border-slate-300 rounded-xl text-sm focus:border-blue-400 outline-none"
          >
            <option value="">-- Pilih Seminar --</option>
            {seminars.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title} — {s.date}
              </option>
            ))}
          </select>
        </div>

        {selectedSeminarId && (
          <div>
            {loadingParticipants ? (
              <div className="text-center py-8">
                <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
                <p className="text-sm text-slate-500 mt-2">Memuat peserta hadir...</p>
              </div>
            ) : participants.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                Belum ada peserta yang hadir untuk seminar ini
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left px-4 py-3 font-semibold text-slate-700">Nama</th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-700">No. Sertifikat</th>
                      <th className="text-center px-4 py-3 font-semibold text-slate-700">Aksi</th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-700">No. WA</th>
                      <th className="text-center px-4 py-3 font-semibold text-slate-700">Sertifikat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {participants.map((p: Participant) => (
                      <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium">{p.fullName}</td>
                        <td className="px-4 py-3">
                          {p.certificateCode ? (
                            <span className="font-mono text-xs text-blue-700 bg-blue-50 px-2 py-1 rounded-lg">
                              {p.certificateCode}
                            </span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => {
                              setEditingParticipant(p);
                              setEditNumber(p.certificateNumber || settings.nextCertificateNumber);
                              setEditError("");
                              setEditModalOpen(true);
                            }}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 text-amber-700 hover:bg-amber-100 transition-all"
                            title={p.certificateCode ? "Edit nomor sertifikat" : "Buat nomor sertifikat"}
                          >
                            ✏️ Edit No.
                          </button>
                        </td>
                        <td className="px-4 py-3 text-slate-500">{p.phoneNumber || <span className="text-red-400">-</span>}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-3 py-1 rounded-lg text-xs font-semibold ${p.certificateSent ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-400"}`}>
                            {p.certificateSent ? "✓ Terkirim" : "Belum"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Edit Certificate Number Modal */}
      {editModalOpen && editingParticipant && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setEditModalOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {editingParticipant.certificateCode ? "Edit Nomor Sertifikat" : "Buat Nomor Sertifikat"}
            </h3>

            <div className="mb-2">
              <p className="text-sm text-slate-500 mb-0.5">Peserta</p>
              <p className="font-medium text-gray-900">{editingParticipant.fullName}</p>
            </div>

            {editingParticipant.certificateCode && (
              <div className="mb-4">
                <p className="text-sm text-slate-500 mb-0.5">Nomor Saat Ini</p>
                <p className="font-mono text-sm text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg inline-block">
                  {editingParticipant.certificateCode}
                </p>
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Nomor Urut Baru
              </label>
              <input
                type="number"
                min="1"
                value={editNumber}
                onChange={(e) => {
                  setEditNumber(parseInt(e.target.value) || 1);
                  setEditError("");
                }}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:border-blue-400 outline-none"
              />
              {generateCode(settings, editNumber) && (
                <p className="mt-2 text-xs text-slate-500">
                  Preview: <span className="font-mono text-blue-600">{generateCode(settings, editNumber)}</span>
                </p>
              )}
            </div>

            {editError && (
              <p className="text-sm text-red-600 mb-4 bg-red-50 px-3 py-2 rounded-lg">{editError}</p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setEditModalOpen(false);
                  setEditingParticipant(null);
                  setEditError("");
                }}
                className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-700 font-semibold rounded-xl hover:bg-slate-50 transition-all text-sm"
              >
                Batal
              </button>
              <button
                onClick={saveCertificateNumber}
                disabled={editLoading}
                className="flex-1 px-4 py-2.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-all disabled:opacity-50 text-sm"
              >
                {editLoading ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Form - Simple 6 Component Fields */}
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
          {/* Nomor Terakhir Diterbitkan */}
          <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl p-4 border border-emerald-200">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
              <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">
                Nomor Terakhir
              </p>
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

          {/* Nomor Selanjutnya */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-200">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-blue-500"></div>
              <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">
                Nomor Selanjutnya
              </p>
            </div>
            <p className="text-2xl font-bold text-blue-800 font-mono">
              {String(settings.nextCertificateNumber).padStart(2, "0")}
            </p>
            <p className="text-xs text-blue-600 mt-1">
              {generateCode(settings, settings.nextCertificateNumber)}
            </p>
          </div>
        </div>

        {/* 6 Komponen Utama */}
        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-4">
          {/* 1. Nomor Urut Berikutnya */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Mulai Dari Nomor
            </label>
            <input
              type="number"
              min="1"
              value={settings.nextCertificateNumber}
              onChange={(e) =>
                setSettings({ ...settings, nextCertificateNumber: parseInt(e.target.value) || 1 })
              }
              className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:border-blue-400 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <p className="text-xs text-slate-400 mt-1">Atur ulang awal penomoran</p>
          </div>

          {/* 2. Jenis Surat */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Jenis Surat
            </label>
            <input
              type="text"
              value={settings.letterType}
              onChange={(e) =>
                setSettings({ ...settings, letterType: e.target.value })
              }
              placeholder="KET"
              className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:border-blue-400 outline-none"
            />
            <p className="text-xs text-slate-400 mt-1">Keterangan</p>
          </div>

          {/* 3. Kode Unit */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Kode Unit
            </label>
            <input
              type="text"
              value={settings.unitCode}
              onChange={(e) =>
                setSettings({ ...settings, unitCode: e.target.value })
              }
              placeholder="IV.6.AU"
              className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:border-blue-400 outline-none"
            />
            <p className="text-xs text-slate-400 mt-1">Kode Instansi/Bagian</p>
          </div>

          {/* 4. Klasifikasi */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Klasifikasi
            </label>
            <input
              type="text"
              value={settings.classification}
              onChange={(e) =>
                setSettings({ ...settings, classification: e.target.value })
              }
              placeholder="A"
              className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:border-blue-400 outline-none"
            />
            <p className="text-xs text-slate-400 mt-1">Kategori Surat</p>
          </div>

          {/* 5. Bulan (readonly) */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Bulan
            </label>
            <div className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 text-slate-600 font-semibold">
              {currentMonthRoman}
            </div>
            <p className="text-xs text-slate-400 mt-1">Otomatis Romawi</p>
          </div>

          {/* 6. Tahun */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Tahun
            </label>
            <input
              type="text"
              value={settings.year}
              onChange={(e) =>
                setSettings({ ...settings, year: e.target.value })
              }
              className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:border-blue-400 outline-none"
            />
            <p className="text-xs text-slate-400 mt-1">Otomatis</p>
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