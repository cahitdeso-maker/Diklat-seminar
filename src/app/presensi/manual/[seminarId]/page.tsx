"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface Seminar {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  useManual: boolean;
  presensiOpen: boolean;
}

export default function CheckinFormPage() {
  const params = useParams();
  const seminarId = params.seminarId as string;

  const [step, setStep] = useState<"form" | "done">("form");
  const [seminar, setSeminar] = useState<Seminar | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phoneNumber: "",
    institution: "",
    profession: "",
  });

  useEffect(() => {
    loadSeminar();
  }, [seminarId]);

  const loadSeminar = async () => {
    try {
      // Ambil data seminar via API checkin (public endpoint)
      const res = await fetch(`/api/checkin?seminarId=${seminarId}`);
      if (res.ok) {
        const s = await res.json();
        setSeminar(s);
      } else {
        const errData = await res.json().catch(() => ({}));
        setError(errData.error || "Gagal memuat data seminar");
      }
    } catch {
      setError("Terjadi kesalahan jaringan");
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seminarId,
          ...formData,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setSuccessMsg(`Check-in atas nama "${formData.fullName}" berhasil!`);
        setStep("done");
      } else {
        setError(data.error || "Gagal check-in. Silakan coba lagi.");
      }
    } catch {
      setError("Terjadi kesalahan. Silakan coba lagi.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setStep("form");
    setFormData({
      fullName: "",
      email: "",
      phoneNumber: "",
      institution: "",
      profession: "",
    });
    setError("");
    setSuccessMsg("");
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-14 h-14 border-4 border-emerald-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-slate-500 font-medium">Memuat data...</p>
        </div>
      </div>
    );
  }

  if (!seminar) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Seminar Tidak Ditemukan</h2>
          <p className="text-slate-500 text-sm mb-4">Link daftar hadir tidak valid.</p>
          <Link href="/checkin" className="text-blue-600 hover:underline text-sm font-medium">
            Kembali ke Daftar Seminar
          </Link>
        </div>
      </div>
    );
  }

  if (!seminar.useManual) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md text-center">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Daftar Hadir Tidak Aktif</h2>
          <p className="text-slate-500 text-sm mb-4">Seminar ini tidak menggunakan daftar hadir manual.</p>
          <Link href="/checkin" className="text-blue-600 hover:underline text-sm font-medium">
            Kembali ke Daftar Seminar
          </Link>
        </div>
      </div>
    );
  }

  if (!seminar.presensiOpen) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md text-center">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Presensi Ditutup</h2>
          <p className="text-slate-500 text-sm mb-4">Presensi untuk seminar ini sedang ditutup oleh admin.</p>
          <Link href="/checkin" className="text-blue-600 hover:underline text-sm font-medium">
            Kembali ke Daftar Seminar
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-100 sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Link href="/checkin" className="flex items-center gap-2">
                <div className="w-9 h-9 bg-gradient-to-br from-emerald-600 to-green-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-200/40">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                <h1 className="text-lg font-bold text-slate-800">Presensi Langsung</h1>
                <p className="text-[10px] text-slate-400">Isi data diri untuk presensi</p>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Seminar Info */}
        <div className="bg-white rounded-2xl shadow-lg shadow-slate-200/50 border border-slate-100 p-5 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-slate-800">{seminar.title}</h2>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {formatDate(seminar.date)}
                </span>
                {seminar.startTime && (
                  <span className="flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {seminar.startTime}{seminar.endTime ? ` - ${seminar.endTime}` : ""}
                  </span>
                )}
                {seminar.location && (
                  <span className="flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {seminar.location}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-5 py-4 rounded-xl text-sm flex items-center gap-2">
            <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            {error}
          </div>
        )}

        {/* STEP 1: Form */}
        {step === "form" && (
          <div className="animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-lg shadow-slate-200/50 border border-slate-100 overflow-hidden">
              {/* Header form seperti register */}
              <div className="bg-gradient-to-r from-emerald-50 to-green-50 border-b border-slate-100 p-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                    <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 font-medium">Seminar Dipilih</p>
                    <h3 className="font-semibold text-slate-800">{seminar.title}</h3>
                    <p className="text-xs text-slate-500">{formatDate(seminar.date)}{seminar.location ? ` - ${seminar.location}` : ""}</p>
                  </div>
                  <Link
                    href="/checkin"
                    className="ml-auto px-3 py-1.5 bg-white rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    Ganti
                  </Link>
                </div>
              </div>

              {/* Form */}
              <div className="p-5 sm:p-8">
                <h3 className="text-lg font-bold text-slate-800 mb-1">Data Peserta</h3>
                <p className="text-sm text-slate-500 mb-6">Isi data diri Anda untuk presensi langsung</p>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="grid sm:grid-cols-2 gap-5">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Nama Lengkap <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                          <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>
                        <input
                          type="text"
                          name="fullName"
                          value={formData.fullName}
                          onChange={handleInputChange}
                          placeholder="Masukkan nama lengkap"
                          className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:border-emerald-400 outline-none focus:ring-2 focus:ring-emerald-50 transition-all"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Email
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                          <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2-2v10a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <input
                          type="email"
                          name="email"
                          value={formData.email}
                          onChange={handleInputChange}
                          placeholder="contoh@email.com"
                          className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:border-emerald-400 outline-none focus:ring-2 focus:ring-emerald-50 transition-all"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        No. WhatsApp
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                          <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                          </svg>
                        </div>
                        <input
                          type="tel"
                          name="phoneNumber"
                          value={formData.phoneNumber}
                          onChange={handleInputChange}
                          placeholder="08xxxxx"
                          className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:border-emerald-400 outline-none focus:ring-2 focus:ring-emerald-50 transition-all"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Institusi / Asal
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                          <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2-2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                        </div>
                        <input
                          type="text"
                          name="institution"
                          value={formData.institution}
                          onChange={handleInputChange}
                          placeholder="Nama instansi/rumah sakit"
                          className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:border-emerald-400 outline-none focus:ring-2 focus:ring-emerald-50 transition-all"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Profesi
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                          <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2-2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2-2v10a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <input
                          type="text"
                          name="profession"
                          value={formData.profession}
                          onChange={handleInputChange}
                          placeholder="Dokter, Perawat, dll"
                          className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:border-emerald-400 outline-none focus:ring-2 focus:ring-emerald-50 transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex items-start gap-3">
                    <svg className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-xs text-emerald-700">
                      Dengan mengisi form ini, Anda akan langsung tercatat sebagai peserta yang telah melakukan check-in / presensi. 
                      Data Anda akan digunakan untuk keperluan presensi dan penerbitan sertifikat.
                    </p>
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <Link
                      href="/checkin"
                      className="px-5 py-3 border border-slate-200 text-slate-700 font-medium rounded-xl text-sm hover:bg-slate-50 transition-all"
                    >
                      Kembali
                    </Link>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="flex-1 py-3 bg-gradient-to-r from-emerald-600 to-green-600 text-white font-semibold rounded-xl hover:from-emerald-700 hover:to-green-700 transition-all disabled:opacity-60 shadow-lg shadow-emerald-200/50 flex items-center justify-center gap-2"
                    >
                      {submitting ? (
                        <>
                          <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                          Memproses...
                        </>
                      ) : (
                        <>
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Presensi Sekarang
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Done */}
        {step === "done" && (
          <div className="animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-lg shadow-slate-200/50 border border-slate-100 overflow-hidden">
              <div className="bg-gradient-to-r from-emerald-500 to-green-600 p-8 text-center">
                <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-white mb-1">Presensi Berhasil!</h2>
                <p className="text-emerald-100 text-sm">{successMsg}</p>
              </div>

              <div className="p-6 text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-emerald-50 to-green-50 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-slate-800 mb-1">{formData.fullName}</h3>
                <p className="text-sm text-slate-500 mb-6">{seminar.title}</p>

                <div className="bg-emerald-50 rounded-xl p-4 mb-6 text-left space-y-2 text-sm">
                  <p><span className="text-slate-400">Nama:</span> <span className="font-medium text-slate-800">{formData.fullName}</span></p>
                  {formData.institution && <p><span className="text-slate-400">Institusi:</span> <span className="text-slate-700">{formData.institution}</span></p>}
                  {formData.profession && <p><span className="text-slate-400">Profesi:</span> <span className="text-slate-700">{formData.profession}</span></p>}
                </div>

                <div className="flex flex-col gap-3">
                  <button
                    onClick={handleReset}
                    className="w-full py-3 bg-gradient-to-r from-emerald-600 to-green-600 text-white font-semibold rounded-xl hover:from-emerald-700 hover:to-green-700 transition-all shadow-lg shadow-emerald-200/50"
                  >
                    Presensi Lagi
                  </button>
                  <Link
                    href="/checkin"
                    className="w-full py-3 bg-slate-100 text-slate-700 font-semibold rounded-xl hover:bg-slate-200 transition-all"
                  >
                    Kembali ke Seminar
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 mt-12">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <p className="text-center text-xs text-slate-400">
            &copy; {new Date().getFullYear()} Diklat RS PKU Muhammadiyah Gombong. Sistem Presensi Medis Pintar.
          </p>
        </div>
      </footer>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.4s ease-out;
        }
      `}</style>
    </div>
  );
}