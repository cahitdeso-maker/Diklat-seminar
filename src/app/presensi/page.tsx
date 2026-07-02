"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

export default function PresensiPage() {
  const [step, setStep] = useState<"cari" | "result" | "done">("cari");
  const [searchType, setSearchType] = useState<"qr" | "face">("qr");
  const [qrCode, setQrCode] = useState("");
  const [participant, setParticipant] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Face ID states
  const [scanning, setScanning] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const verificationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastVerifiedRef = useRef<string | null>(null);

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      stopCamera();
      if (verificationIntervalRef.current) {
        clearInterval(verificationIntervalRef.current);
      }
    };
  }, []);

  // Start/stop camera when switching to/from face mode
  useEffect(() => {
    if (step === "cari" && searchType === "face") {
      startFaceScan();
    } else {
      stopCamera();
    }
  }, [step, searchType]);

  // Attach stream to video element when it's ready
  useEffect(() => {
    if (videoRef.current && streamRef.current && scanning) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [videoRef.current, scanning]);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (verificationIntervalRef.current) {
      clearInterval(verificationIntervalRef.current);
      verificationIntervalRef.current = null;
    }
    setScanning(false);
    setVerifying(false);
    lastVerifiedRef.current = null;
  };

  const startFaceScan = async () => {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 480 },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setScanning(true);
      startAutoVerification();
    } catch {
      setError("Tidak dapat mengakses kamera. Pastikan izin kamera diberikan.");
      setScanning(false);
    }
  };

  const startAutoVerification = () => {
    // Verify every 3 seconds
    verificationIntervalRef.current = setInterval(() => {
      if (videoRef.current && !verifying && scanning) {
        captureAndVerify();
      }
    }, 3000);
  };

  const captureAndVerify = async () => {
    if (!videoRef.current || verifying) return;

    setVerifying(true);
    setError("");

    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setVerifying(false);
      return;
    }

    ctx.drawImage(videoRef.current, 0, 0);
    const imageData = canvas.toDataURL("image/jpeg", 0.8);

    try {
      const res = await fetch("/api/attendance/face", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: imageData }),
      });
      const data = await res.json();
      if (res.ok && data.participant) {
        // Prevent duplicate verification for same person
        if (lastVerifiedRef.current !== data.participant.id) {
          lastVerifiedRef.current = data.participant.id;
          setParticipant(data.participant);
          setStep("done");
          stopCamera();
        }
      } else {
        // Face not recognized, continue scanning
        setVerifying(false);
      }
    } catch {
      setVerifying(false);
    }
  };

  const searchByQr = async () => {
    if (!qrCode.trim()) {
      setError("Masukkan kode QR");
      return;
    }
    setLoading(true);
    setError("");
    try {
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

  const resetSearch = () => {
    setStep("cari");
    setParticipant(null);
    setQrCode("");
    setError("");
    stopCamera();
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
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-8">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-slate-800">
            Presensi Peserta
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Scan QR Code atau verifikasi dengan Face ID
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
                onClick={() => {
                  setSearchType("qr");
                  stopCamera();
                }}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${searchType === "qr" ? "bg-white shadow-sm text-blue-600" : "text-slate-500"}`}
              >
                QR Code
              </button>
              <button
                onClick={() => setSearchType("face")}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${searchType === "face" ? "bg-white shadow-sm text-blue-600" : "text-slate-500"}`}
              >
                Face ID
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
                <div className="text-center">
                  <div className="w-20 h-20 bg-gradient-to-br from-green-50 to-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg
                      className="w-10 h-10 text-green-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      />
                    </svg>
                  </div>
                  <p className="text-sm text-slate-500 mb-4">
                    Arahkan wajah ke kamera untuk verifikasi
                  </p>
                </div>

                {/* Camera View */}
                <div className="relative aspect-[4/3] bg-black rounded-xl overflow-hidden">
                  {scanning ? (
                    <video
                      ref={videoRef}
                      className="w-full h-full object-cover"
                      autoPlay
                      playsInline
                      muted
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                      <svg
                        className="w-16 h-16 mb-3"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                      <p className="text-center px-4 text-sm">Kamera akan muncul di sini</p>
                    </div>
                  )}

                  {/* Face scan overlay */}
                  {scanning && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-44 h-44 border-2 border-green-400 rounded-full relative animate-pulse">
                        <div className="absolute -top-1 -left-1 w-6 h-6 border-t-2 border-l-2 border-green-400 rounded-tl-full"></div>
                        <div className="absolute -top-1 -right-1 w-6 h-6 border-t-2 border-r-2 border-green-400 rounded-tr-full"></div>
                        <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-2 border-l-2 border-green-400 rounded-bl-full"></div>
                        <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-2 border-r-2 border-green-400 rounded-br-full"></div>
                      </div>
                    </div>
                  )}

                  {/* Auto scanning status */}
                  {scanning && (
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 pointer-events-none">
                      <div className="bg-black/70 text-white px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                        <span>Memindai wajah otomatis...</span>
                      </div>
                      <button
                        onClick={stopCamera}
                        className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors shadow-lg pointer-events-auto"
                      >
                        Hentikan Scan
                      </button>
                    </div>
                  )}
                  {verifying && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <div className="text-center">
                        <div className="animate-spin w-10 h-10 border-4 border-white border-t-transparent rounded-full mx-auto mb-3"></div>
                        <p className="text-white font-medium">Memverifikasi wajah...</p>
                      </div>
                    </div>
                  )}
                </div>
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
                onClick={resetSearch}
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
              onClick={resetSearch}
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