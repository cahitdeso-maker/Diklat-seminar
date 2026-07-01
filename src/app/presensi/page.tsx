"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function PresensiPage() {
  const [step, setStep] = useState<"cari" | "result" | "done">("cari");
  const [searchType, setSearchType] = useState<"qr" | "nama">("qr");
  const [qrCode, setQrCode] = useState("");
  const [searchName, setSearchName] = useState("");
  const [seminars, setSeminars] = useState<any[]>([]);
  const [selectedSeminarId, setSelectedSeminarId] = useState("");
  const [participant, setParticipant] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/seminars?active=true")
      .then((r) => r.ok && r.json())
      .then((d) => setSeminars(d || []));
  }, []);

  const searchByQr = async () => {
    if (!qrCode.trim()) {
      setError("Masukkan kode QR");
      return;
    }
    setLoading(true);
    setError("");
    try {
      // Cari di semua registrasi
      const res = await fetch(`/api/registrations`);
      if (res.ok) {
        const all = await res.json();
        const found = Array.isArray(all)
          ? all.find((r: any) => r.qrCode === qrCode.trim().toUpperCase())
          : null;
        if (found) {
          setParticipant(found);
          setStep("result");
        } else {
          setError("Kode QR tidak ditemukan");
        }
      }
    } catch {
      setError("Gagal mencari");
    } finally {
      setLoading(false);
    }
  };

  const searchByName = async () => {
    if (!searchName.trim() || !selectedSeminarId) {
      setError("Nama dan seminar harus diisi");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/registrations?seminarId=${selectedSeminarId}`,
      );
      if (res.ok) {
        const all = await res.json();
        const found = Array.isArray(all)
          ? all.find((r: any) =>
              r.fullName.toLowerCase().includes(searchName.toLowerCase()),
            )
          : null;
        if (found) {
          setParticipant(found);
          setStep("result");
        } else {
          setError("Peserta tidak ditemukan");
        }
      }
    } catch {
      setError("Gagal mencari");
    } finally {
      setLoading(false);
    }
  };

  const markPresent = async () => {
    if (!participant) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/registrations?id=${participant.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPresent: true, presentMethod: "qr" }),
      });
      if (res.ok) {
        setStep("done");
      } else {
        setError("Gagal presensi");
      }
    } catch {
      setError("Gagal");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-100 sticky top-0 z-50">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center shadow-sm">
              <svg
                className="w-4 h-4 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
                />
              </svg>
            </div>
            <span className="text-base font-bold text-slate-800">Presensi</span>
          </Link>
          <Link
            href="/admin/dashboard"
            className="text-xs text-blue-600 font-medium"
          >
            Admin
          </Link>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-8">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-slate-800">
            Presensi Peserta
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Scan QR Code atau cari nama peserta
          </p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm mb-4">
            {error}
          </div>
        )}

        {/* Toggle search type */}
        {step === "cari" && (
          <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 p-6">
            <div className="flex bg-slate-100 rounded-xl p-1 mb-6">
              <button
                onClick={() => setSearchType("qr")}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${searchType === "qr" ? "bg-white shadow-sm text-blue-600" : "text-slate-500"}`}
              >
                QR Code
              </button>
              <button
                onClick={() => setSearchType("nama")}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${searchType === "nama" ? "bg-white shadow-sm text-blue-600" : "text-slate-500"}`}
              >
                Cari Nama
              </button>
            </div>

            {searchType === "qr" ? (
              <div className="space-y-4">
                <div className="text-center">
                  <div className="w-20 h-20 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg
                      className="w-10 h-10 text-blue-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
                      />
                    </svg>
                  </div>
                  <p className="text-sm text-slate-500 mb-4">
                    Masukkan kode QR peserta
                  </p>
                </div>
                <input
                  type="text"
                  value={qrCode}
                  onChange={(e) => setQrCode(e.target.value.toUpperCase())}
                  placeholder="SEMINAR-XXXX-XXXX"
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm font-mono tracking-wider focus:border-blue-400 outline-none text-center uppercase"
                />
                <button
                  onClick={searchByQr}
                  disabled={loading}
                  className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-60 shadow-lg shadow-blue-200/50"
                >
                  {loading ? "Mencari..." : "Cari"}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Pilih Seminar
                  </label>
                  <select
                    value={selectedSeminarId}
                    onChange={(e) => setSelectedSeminarId(e.target.value)}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm focus:border-blue-400 outline-none"
                  >
                    <option value="">-- Pilih --</option>
                    {seminars.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Nama Peserta
                  </label>
                  <input
                    type="text"
                    value={searchName}
                    onChange={(e) => setSearchName(e.target.value)}
                    placeholder="Ketik nama peserta"
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm focus:border-blue-400 outline-none"
                  />
                </div>
                <button
                  onClick={searchByName}
                  disabled={loading}
                  className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-60 shadow-lg shadow-blue-200/50"
                >
                  {loading ? "Mencari..." : "Cari"}
                </button>
              </div>
            )}
          </div>
        )}

        {step === "result" && participant && (
          <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 p-6">
            <div className="text-center mb-6">
              <div
                className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3 ${participant.isPresent ? "bg-green-100" : "bg-blue-100"}`}
              >
                <svg
                  className={`w-8 h-8 ${participant.isPresent ? "text-green-600" : "text-blue-600"}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d={
                      participant.isPresent
                        ? "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                        : "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    }
                  />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-slate-800">
                {participant.fullName}
              </h3>
              <p className="text-sm text-slate-500">
                {participant.email || participant.phoneNumber}
              </p>
            </div>

            <div className="bg-slate-50 rounded-xl p-4 mb-6 space-y-2 text-sm">
              <p>
                <span className="text-slate-400">Institusi:</span>{" "}
                {participant.institution || "-"}
              </p>
              <p>
                <span className="text-slate-400">Profesi:</span>{" "}
                {participant.profession || "-"}
              </p>
              <p>
                <span className="text-slate-400">Status:</span>{" "}
                {participant.isPresent ? (
                  <span className="text-green-600 font-semibold">
                    ✓ Sudah Presensi
                  </span>
                ) : (
                  <span className="text-amber-600 font-semibold">
                    Belum Presensi
                  </span>
                )}
              </p>
              {participant.presentTime && (
                <p>
                  <span className="text-slate-400">Waktu:</span>{" "}
                  {new Date(participant.presentTime).toLocaleString("id-ID")}
                </p>
              )}
            </div>

            {!participant.isPresent ? (
              <button
                onClick={markPresent}
                disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all disabled:opacity-60 shadow-lg shadow-green-200/50"
              >
                {loading ? "Memproses..." : "Konfirmasi Presensi"}
              </button>
            ) : (
              <button
                onClick={() => {
                  setStep("cari");
                  setParticipant(null);
                  setQrCode("");
                }}
                className="w-full py-3 bg-slate-100 text-slate-700 font-semibold rounded-xl hover:bg-slate-200 transition-all"
              >
                Cari Lagi
              </button>
            )}
          </div>
        )}

        {step === "done" && (
          <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 p-8 text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-10 h-10 text-green-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">
              Presensi Berhasil!
            </h2>
            <p className="text-slate-500 mb-6">
              {participant?.fullName} telah terverifikasi.
            </p>
            <button
              onClick={() => {
                setStep("cari");
                setParticipant(null);
                setQrCode("");
                setSearchName("");
              }}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg shadow-blue-200/50"
            >
              Presensi Lagi
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
