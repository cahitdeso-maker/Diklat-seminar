"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

interface Seminar {
  id: string;
  title: string;
  description: string;
  speaker: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  maxParticipants: number;
  useQr: boolean;
  useFace: boolean;
}

interface RegistrationResult {
  id: string;
  qrCode: string;
  fullName: string;
  seminarTitle: string;
  seminarDate: string;
  seminarLocation: string;
}

export default function Home() {
  const [seminars, setSeminars] = useState<Seminar[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSeminar, setSelectedSeminar] = useState<Seminar | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [step, setStep] = useState<"form" | "camera" | "success">("form");
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phoneNumber: "",
    institution: "",
    profession: "",
  });
  const [facePhoto, setFacePhoto] = useState<string | null>(null);
  const [result, setResult] = useState<RegistrationResult | null>(null);
  const [qrImageUrl, setQrImageUrl] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraReady, setCameraReady] = useState(false);

  useEffect(() => {
    loadSeminars();
  }, []);

  useEffect(() => {
    if (result?.qrCode) {
      // Generate QR code image using API
      import("qrcode").then((QRCode) => {
        QRCode.toDataURL(result.qrCode, {
          width: 300,
          margin: 2,
          color: { dark: "#1e40af", light: "#ffffff" },
        }).then((url: string) => setQrImageUrl(url));
      });
    }
  }, [result]);

  const loadSeminars = async () => {
    try {
      const res = await fetch("/api/seminars?active=true");
      if (res.ok) {
        const data = await res.json();
        setSeminars(data);
      }
    } catch (e) {
      console.error("Failed to load seminars", e);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = (seminar: Seminar) => {
    setSelectedSeminar(seminar);
    setShowForm(true);
    setStep("form");
    setError("");
    setFacePhoto(null);
    setQrImageUrl(null);
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const goToCamera = async () => {
    setStep("camera");
    setCameraReady(false);

    if (typeof window !== "undefined") {
      const isLocalhost =
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1";
      const isHttps = window.location.protocol === "https:";

      if (!isLocalhost && !isHttps) {
        setError(
          "⚠️ Kamera hanya dapat diakses melalui localhost atau HTTPS. Klik 'Lewati' untuk melanjutkan.",
        );
        return;
      }
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 480 },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadeddata = () => setCameraReady(true);
      }
    } catch {
      setError(
        "⚠️ Kamera tidak dapat diakses. Klik 'Lewati' untuk melanjutkan tanpa foto wajah.",
      );
    }
  };

  const capturePhoto = () => {
    if (canvasRef.current && videoRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      canvasRef.current.width = videoRef.current.videoWidth || 640;
      canvasRef.current.height = videoRef.current.videoHeight || 480;
      ctx?.drawImage(
        videoRef.current,
        0,
        0,
        canvasRef.current.width,
        canvasRef.current.height,
      );
      const dataUrl = canvasRef.current.toDataURL("image/jpeg", 0.7);
      setFacePhoto(dataUrl);
      setCameraReady(false);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    }
  };

  const retakePhoto = () => {
    setFacePhoto(null);
    setStep("camera");
    goToCamera();
  };

  const submitRegistration = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError("");
    if (!selectedSeminar) return;
    if (!formData.fullName || !formData.email) {
      setError("Nama dan email harus diisi");
      return;
    }
    if (selectedSeminar.useFace && step === "form") {
      goToCamera();
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/registrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seminarId: selectedSeminar.id,
          fullName: formData.fullName,
          email: formData.email,
          phoneNumber: formData.phoneNumber,
          institution: formData.institution,
          profession: formData.profession,
          faceData: facePhoto,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult(data.registration);
        setStep("success");
      } else {
        setError(data.error || "Gagal mendaftar");
      }
    } catch {
      setError("Terjadi kesalahan jaringan");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("id-ID", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-100 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-md">
              <svg
                className="w-5 h-5 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                />
              </svg>
            </div>
            <span className="text-lg font-bold text-slate-800">
              Presensi Seminar
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/presensi"
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Presensi
            </Link>
            <Link
              href="/admin/dashboard"
              className="text-sm px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all font-medium"
            >
              Admin
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {!showForm && (
          <>
            <div className="text-center mb-10">
              <h1 className="text-3xl md:text-4xl font-bold text-slate-800 mb-3">
                Daftar Seminar & Pelatihan
              </h1>
              <p className="text-slate-500 max-w-2xl mx-auto">
                RS PKU Muhammadiyah Gombong — Bagian Diklat
              </p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-100 text-red-700 p-4 rounded-xl text-sm mb-6 max-w-lg mx-auto">
                {error}
              </div>
            )}

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {loading ? (
                <div className="col-span-full flex justify-center py-12">
                  <div className="animate-spin w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full"></div>
                </div>
              ) : seminars.length === 0 ? (
                <div className="col-span-full text-center py-12">
                  <p className="text-slate-400">Belum ada seminar tersedia</p>
                </div>
              ) : (
                seminars.map((sem) => (
                  <div
                    key={sem.id}
                    className="bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-all flex flex-col"
                  >
                    <div className="p-6 flex-1">
                      <div className="flex items-center gap-2 mb-3">
                        <div
                          className={`w-2 h-2 rounded-full ${sem.date === new Date().toISOString().split("T")[0] ? "bg-green-500" : new Date(sem.date) > new Date() ? "bg-blue-500" : "bg-slate-300"}`}
                        ></div>
                        <span
                          className={`text-xs font-medium ${sem.date === new Date().toISOString().split("T")[0] ? "text-green-600" : new Date(sem.date) > new Date() ? "text-blue-600" : "text-slate-400"}`}
                        >
                          {sem.date === new Date().toISOString().split("T")[0]
                            ? "Hari Ini"
                            : new Date(sem.date) > new Date()
                              ? "Akan Datang"
                              : "Sudah Berlalu"}
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-slate-800 mb-3">
                        {sem.title}
                      </h3>
                      {sem.speaker && (
                        <p className="text-sm text-slate-500 mb-1">
                          <span className="font-medium text-slate-600">
                            Pembicara:
                          </span>{" "}
                          {sem.speaker}
                        </p>
                      )}
                      <p className="text-sm text-slate-500 mb-1">
                        📅 {formatDate(sem.date)}
                      </p>
                      {sem.startTime && (
                        <p className="text-sm text-slate-500 mb-1">
                          🕐 {sem.startTime}
                          {sem.endTime ? ` - ${sem.endTime}` : ""} WIB
                        </p>
                      )}
                      {sem.location && (
                        <p className="text-sm text-slate-500 mb-1">
                          📍 {sem.location}
                        </p>
                      )}
                      {sem.description && (
                        <p className="text-sm text-slate-400 mt-3 line-clamp-2">
                          {sem.description}
                        </p>
                      )}
                    </div>
                    <div className="px-6 pb-6">
                      <button
                        onClick={() => handleRegister(sem)}
                        className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md"
                      >
                        Daftar Sekarang
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {/* Form Pendaftaran */}
        {showForm && selectedSeminar && step === "form" && (
          <div className="max-w-lg mx-auto">
            <button
              onClick={() => {
                setShowForm(false);
                setSelectedSeminar(null);
                setQrImageUrl(null);
              }}
              className="text-sm text-blue-600 hover:text-blue-700 mb-4 flex items-center gap-1"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              Kembali
            </button>
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-slate-800">
                  Pendaftaran
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  {selectedSeminar.title} — {formatDate(selectedSeminar.date)}
                </p>
              </div>
              {error && (
                <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm mb-4">
                  {error}
                </div>
              )}

              <form onSubmit={submitRegistration} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Nama Lengkap <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none"
                    placeholder="Nama lengkap Anda"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none"
                    placeholder="email@anda.com"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    No. WhatsApp
                  </label>
                  <input
                    type="tel"
                    name="phoneNumber"
                    value={formData.phoneNumber}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none"
                    placeholder="08XXXXXXXXXX"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Asal Institusi
                  </label>
                  <input
                    type="text"
                    name="institution"
                    value={formData.institution}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none"
                    placeholder="RS / Universitas / Institusi"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Profesi
                  </label>
                  <select
                    name="profession"
                    value={formData.profession}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm focus:border-blue-400 outline-none"
                  >
                    <option value="">-- Pilih Profesi --</option>
                    <option value="Dokter">Dokter</option>
                    <option value="Perawat">Perawat</option>
                    <option value="Bidan">Bidan</option>
                    <option value="Mahasiswa">Mahasiswa</option>
                    <option value="Tenaga Kesehatan">
                      Tenaga Kesehatan Lainnya
                    </option>
                    <option value="Umum">Umum</option>
                  </select>
                </div>
                {selectedSeminar.useFace && (
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
                    <p className="text-sm text-blue-700">
                      <span className="font-semibold">📸 Face ID:</span> Setelah
                      mendaftar, Anda akan diminta mengambil foto wajah untuk
                      verifikasi presensi.
                    </p>
                  </div>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-60 shadow-md"
                >
                  {loading
                    ? "Memproses..."
                    : selectedSeminar.useFace
                      ? "Lanjut ke Foto Wajah"
                      : "Daftar Sekarang"}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Camera */}
        {showForm && step === "camera" && selectedSeminar && (
          <div className="max-w-md mx-auto">
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h3 className="text-lg font-bold text-slate-800 text-center mb-4">
                📸 Foto Wajah untuk Verifikasi
              </h3>
              {error && (
                <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm mb-4">
                  {error}
                </div>
              )}
              {!facePhoto ? (
                <>
                  <div className="bg-slate-900 rounded-2xl overflow-hidden mb-4">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full aspect-[4/3] object-cover"
                    />
                  </div>
                  <canvas ref={canvasRef} className="hidden" />
                  {!cameraReady && (
                    <p className="text-sm text-slate-500 text-center mb-4">
                      Mengakses kamera...
                    </p>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setStep("form");
                        setFacePhoto(null);
                        if (streamRef.current) {
                          streamRef.current
                            .getTracks()
                            .forEach((t) => t.stop());
                          streamRef.current = null;
                        }
                      }}
                      className="px-4 py-3 bg-slate-100 text-slate-700 font-semibold rounded-xl hover:bg-slate-200 transition-all text-sm"
                    >
                      Kembali
                    </button>
                    <button
                      onClick={capturePhoto}
                      disabled={!cameraReady}
                      className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 shadow-md text-sm"
                    >
                      Ambil Foto
                    </button>
                    <button
                      onClick={submitRegistration}
                      className="px-4 py-3 bg-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-300 transition-all text-sm"
                    >
                      Lewati
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="bg-slate-100 rounded-2xl overflow-hidden mb-4">
                    <img
                      src={facePhoto}
                      alt="Foto"
                      className="w-full aspect-[4/3] object-cover"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={retakePhoto}
                      className="flex-1 py-3 bg-slate-100 text-slate-700 font-semibold rounded-xl hover:bg-slate-200 transition-all"
                    >
                      Ulang Foto
                    </button>
                    <button
                      onClick={submitRegistration}
                      disabled={loading}
                      className="flex-[2] py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-60 shadow-md"
                    >
                      {loading ? "Mendaftarkan..." : "Selesai & Daftar"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Success dengan QR Code gambar */}
        {step === "success" && result && (
          <div className="max-w-lg mx-auto">
            <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
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
                Pendaftaran Berhasil!
              </h2>
              <p className="text-slate-500 mb-6">
                Selamat datang,{" "}
                <span className="font-semibold">{result.fullName}</span>
              </p>

              <div className="bg-slate-50 rounded-xl p-6 mb-6 text-left">
                <h3 className="font-semibold text-slate-700 mb-3">
                  Data Pendaftaran
                </h3>
                <div className="space-y-2 text-sm">
                  <p>
                    <span className="text-slate-400">Seminar:</span>{" "}
                    <span className="font-medium">{result.seminarTitle}</span>
                  </p>
                  <p>
                    <span className="text-slate-400">Tanggal:</span>{" "}
                    {formatDate(result.seminarDate)}
                  </p>
                  {result.seminarLocation && (
                    <p>
                      <span className="text-slate-400">Lokasi:</span>{" "}
                      {result.seminarLocation}
                    </p>
                  )}
                </div>
              </div>

              {/* QR CODE GAMBAR */}
              <div className="bg-white rounded-xl p-4 mb-6 border-2 border-dashed border-blue-200">
                <p className="text-sm font-semibold text-slate-700 mb-3">
                  📱 Scan QR Code untuk Presensi
                </p>
                {qrImageUrl ? (
                  <img
                    src={qrImageUrl}
                    alt="QR Code"
                    className="w-48 h-48 mx-auto"
                  />
                ) : (
                  <div className="w-48 h-48 mx-auto bg-slate-100 rounded-xl flex items-center justify-center">
                    <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
                  </div>
                )}
                <p className="text-xs text-slate-400 mt-3">
                  Tunjukkan QR Code ini kepada petugas saat presensi
                </p>
              </div>

              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100 mb-6 text-left">
                <p className="text-sm text-blue-700">
                  <span className="font-semibold">📌 Informasi:</span>{" "}
                  Sertifikat akan dikirim ke email Anda setelah seminar selesai.
                </p>
              </div>

              <button
                onClick={() => {
                  setShowForm(false);
                  setSelectedSeminar(null);
                  setStep("form");
                  setResult(null);
                  setQrImageUrl(null);
                  setFormData({
                    fullName: "",
                    email: "",
                    phoneNumber: "",
                    institution: "",
                    profession: "",
                  });
                  setFacePhoto(null);
                }}
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md"
              >
                Kembali ke Beranda
              </button>
            </div>
          </div>
        )}
      </main>

      <footer className="text-center py-6 text-xs text-slate-400">
        &copy; {new Date().getFullYear()} RS PKU Muhammadiyah Gombong — Bagian
        Diklat
      </footer>
    </div>
  );
}
