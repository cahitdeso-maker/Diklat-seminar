"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

interface Seminar {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  useQr: boolean;
  useFace: boolean;
}

interface Registration {
  id: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  institution: string;
  profession: string;
  qrCode: string;
  isPresent: boolean;
  presentTime: string | null;
  presentMethod: string | null;
}

export default function AttendanceSeminarPage() {
  const params = useParams();
  const seminarId = params.seminarId as string;
  const [seminar, setSeminar] = useState<Seminar | null>(null);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"face" | "qr" | "code">("face");
  const [error, setError] = useState("");

  useEffect(() => {
    loadData();
  }, [seminarId]);

  const loadData = async () => {
    try {
      const [seminarRes, regRes] = await Promise.all([
        fetch(`/api/seminars/${seminarId}`),
        fetch(`/api/registrations?seminarId=${seminarId}`),
      ]);

      if (seminarRes.ok) {
        setSeminar(await seminarRes.json());
      }
      if (regRes.ok) {
        setRegistrations(await regRes.json());
      }
    } catch {
      setError("Gagal memuat data");
    } finally {
      setLoading(false);
    }
  };

  const presentCount = registrations.filter((r) => r.isPresent).length;
  const totalCount = registrations.length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin w-10 h-10 border-4 border-green-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!seminar) {
    return (
      <div className="text-center py-12">
        <div className="bg-red-50 text-red-600 p-4 rounded-xl inline-block">
          Seminar tidak ditemukan
        </div>
      </div>
    );
  }

  const tabs = [
    { id: "face" as const, label: "Face Recognition", icon: FaceIcon, enabled: seminar.useFace },
    { id: "qr" as const, label: "Scan QR Code", icon: QrIcon, enabled: seminar.useQr },
    { id: "code" as const, label: "Input Kode Manual", icon: CodeIcon, enabled: true },
  ].filter((t) => t.enabled);

  return (
    <div className="space-y-6">
      {/* Seminar Header */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">{seminar.title}</h1>
            <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-slate-600">
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {new Date(seminar.date).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              </span>
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {seminar.startTime} - {seminar.endTime}
              </span>
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {seminar.location}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="bg-slate-50 rounded-xl p-4 text-center min-w-[120px]">
              <div className="text-3xl font-bold text-green-600">{presentCount}</div>
              <div className="text-xs text-slate-500">Hadir</div>
            </div>
            <div className="bg-slate-50 rounded-xl p-4 text-center min-w-[120px]">
              <div className="text-3xl font-bold text-slate-600">{totalCount}</div>
              <div className="text-xs text-slate-500">Total Peserta</div>
            </div>
            <div className="bg-slate-50 rounded-xl p-4 text-center min-w-[120px]">
              <div className="text-3xl font-bold text-amber-600">{totalCount - presentCount}</div>
              <div className="text-xs text-slate-500">Belum Hadir</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="border-b border-slate-200">
          <nav className="flex overflow-x-auto" aria-label="Metode presensi">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? "border-green-500 text-green-600 bg-green-50"
                    : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                }`}
              >
                <tab.icon className="w-5 h-5" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === "face" && <FaceRecognitionTab seminarId={seminarId} registrations={registrations} onUpdate={loadData} />}
          {activeTab === "qr" && <QrScannerTab seminarId={seminarId} registrations={registrations} onUpdate={loadData} />}
          {activeTab === "code" && <ManualCodeTab seminarId={seminarId} registrations={registrations} onUpdate={loadData} onSwitchTab={setActiveTab} />}
        </div>
      </div>
    </div>
  );
}

function FaceIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}

function QrIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zm-12 8h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1v-2a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1z" />
    </svg>
  );
}

function CodeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
    </svg>
  );
}

// Face Recognition Tab
function FaceRecognitionTab({ seminarId, registrations, onUpdate }: { seminarId: string; registrations: Registration[]; onUpdate: () => void }) {
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; participant?: Registration } | null>(null);
  const [videoRef, setVideoRef] = useState<HTMLVideoElement | null>(null);

  const startScanning = async () => {
    setScanning(true);
    setResult(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      if (videoRef) {
        videoRef.srcObject = stream;
        videoRef.play();
      }
    } catch (err) {
      setResult({ success: false, message: "Tidak dapat mengakses kamera. Pastikan izin kamera diberikan." });
      setScanning(false);
    }
  };

  const stopScanning = () => {
    if (videoRef?.srcObject) {
      const stream = videoRef.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.srcObject = null;
    }
    setScanning(false);
  };

  const captureAndVerify = async () => {
    if (!videoRef) return;
    
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.videoWidth;
    canvas.height = videoRef.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    ctx.drawImage(videoRef, 0, 0);
    const imageData = canvas.toDataURL("image/jpeg", 0.8);
    
    try {
      const res = await fetch("/api/attendance/face", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seminarId, image: imageData }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult({ success: true, message: `Presensi berhasil untuk ${data.participant.fullName}`, participant: data.participant });
        onUpdate();
      } else {
        setResult({ success: false, message: data.error || "Wajah tidak dikenali" });
      }
    } catch {
      setResult({ success: false, message: "Gagal memverifikasi wajah" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-green-50 border border-green-200 rounded-xl p-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
            <FaceIcon className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <h3 className="font-semibold text-green-800">Face Recognition</h3>
            <p className="text-sm text-green-600">Arahkan wajah peserta ke kamera untuk verifikasi</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Camera View */}
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
          <h4 className="font-medium text-slate-800 mb-3">Kamera</h4>
          <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
            {scanning && videoRef ? (
              <video
                ref={setVideoRef}
                className="w-full h-full object-cover"
                autoPlay
                playsInline
                muted
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                <svg className="w-16 h-16 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <p className="text-center px-4">Kamera akan muncul di sini</p>
              </div>
            )}
            {!scanning && (
              <button
                onClick={startScanning}
                className="absolute bottom-4 left-1/2 -translate-x-1/2 px-6 py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 transition-colors shadow-lg"
              >
                Mulai Scan Wajah
              </button>
            )}
            {scanning && (
              <button
                onClick={captureAndVerify}
                className="absolute bottom-4 left-1/2 -translate-x-1/2 px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-lg"
              >
                Ambil & Verifikasi
              </button>
            )}
          </div>
        </div>

        {/* Result / Instructions */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h4 className="font-medium text-slate-800 mb-4">Hasil Verifikasi</h4>
          {result ? (
            <div className={`p-4 rounded-xl ${result.success ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${result.success ? "bg-green-100" : "bg-red-100"}`}>
                  {result.success ? (
                    <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                </div>
                <div>
                  <p className={`font-medium ${result.success ? "text-green-800" : "text-red-800"}`}>{result.message}</p>
                  {result.participant && (
                    <p className="text-sm text-slate-500 mt-1">
                      {result.participant.institution} • {result.participant.profession}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500">
              <p className="mb-2">Klik "Mulai Scan Wajah" untuk memulai</p>
              <p className="text-sm">Pastikan pencahayaan cukup dan wajah terlihat jelas</p>
            </div>
          )}
        </div>
      </div>

      {/* Recent Attendance */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="font-semibold text-slate-800">Presensi Terbaru (Face Recognition)</h3>
        </div>
        <div className="divide-y divide-slate-100">
          {registrations
            .filter((r) => r.isPresent && r.presentMethod === "face")
            .slice(0, 10)
            .map((reg) => (
              <div key={reg.id} className="px-6 py-4 hover:bg-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-slate-800">{reg.fullName}</p>
                    <p className="text-sm text-slate-500">{reg.institution} • {reg.profession}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-700">Hadir</span>
                  <p className="text-xs text-slate-500 mt-1">{reg.presentTime ? new Date(reg.presentTime).toLocaleString("id-ID") : ""}</p>
                </div>
              </div>
            ))}
          {registrations.filter((r) => r.isPresent && r.presentMethod === "face").length === 0 && (
            <div className="px-6 py-8 text-center text-slate-500">
              Belum ada presensi via Face Recognition
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// QR Scanner Tab
function QrScannerTab({ seminarId, registrations, onUpdate }: { seminarId: string; registrations: Registration[]; onUpdate: () => void }) {
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; participant?: Registration } | null>(null);
  const [videoRef, setVideoRef] = useState<HTMLVideoElement | null>(null);
  const [scanInterval, setScanInterval] = useState<NodeJS.Timeout | null>(null);

  const startScanning = async () => {
    setScanning(true);
    setResult(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      if (videoRef) {
        videoRef.srcObject = stream;
        videoRef.play();
      }
      // Start scanning interval
      const interval = setInterval(() => {
        if (videoRef && videoRef.readyState === videoRef.HAVE_ENOUGH_DATA) {
          scanQRCode();
        }
      }, 500);
      setScanInterval(interval);
    } catch (err) {
      setResult({ success: false, message: "Tidak dapat mengakses kamera. Pastikan izin kamera diberikan." });
      setScanning(false);
    }
  };

  const stopScanning = () => {
    if (videoRef?.srcObject) {
      const stream = videoRef.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.srcObject = null;
    }
    if (scanInterval) clearInterval(scanInterval);
    setScanning(false);
  };

  const scanQRCode = () => {
    if (!videoRef) return;
    
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.videoWidth;
    canvas.height = videoRef.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    ctx.drawImage(videoRef, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    // Simple QR code detection - in production use a proper library like jsQR
    // For now, we'll simulate by checking if there's a QR code pattern
    // This is a placeholder - real implementation would use jsQR or similar
  };

  const verifyQRCode = async (qrCode: string) => {
    try {
      const res = await fetch("/api/attendance/qr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seminarId, qrCode: qrCode.toUpperCase() }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult({ success: true, message: `Presensi berhasil untuk ${data.participant.fullName}`, participant: data.participant });
        onUpdate();
      } else {
        setResult({ success: false, message: data.error || "QR Code tidak valid" });
      }
    } catch {
      setResult({ success: false, message: "Gagal memverifikasi QR Code" });
    }
  };

  // For demo purposes, add manual QR input
  const [manualQr, setManualQr] = useState("");

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualQr.trim()) {
      verifyQRCode(manualQr.trim());
      setManualQr("");
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
            <QrIcon className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-blue-800">Scan QR Code</h3>
            <p className="text-sm text-blue-600">Arahkan kamera ke QR Code peserta atau masukkan kode manual</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Camera View */}
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
          <h4 className="font-medium text-slate-800 mb-3">Kamera Scanner</h4>
          <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
            {scanning && videoRef ? (
              <video
                ref={setVideoRef}
                className="w-full h-full object-cover"
                autoPlay
                playsInline
                muted
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                <svg className="w-16 h-16 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                </svg>
                <p className="text-center px-4">Kamera akan muncul di sini</p>
              </div>
            )}
            {!scanning && (
              <button
                onClick={startScanning}
                className="absolute bottom-4 left-1/2 -translate-x-1/2 px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-lg"
              >
                Mulai Scan QR
              </button>
            )}
            {scanning && (
              <button
                onClick={stopScanning}
                className="absolute bottom-4 left-1/2 -translate-x-1/2 px-6 py-3 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700 transition-colors shadow-lg"
              >
                Hentikan Scan
              </button>
            )}
            {/* Scanning overlay */}
            {scanning && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-48 h-48 border-2 border-blue-500 rounded-lg relative">
                  <div className="absolute -top-2 -left-2 w-4 h-4 border-t-2 border-l-2 border-blue-500"></div>
                  <div className="absolute -top-2 -right-2 w-4 h-4 border-t-2 border-r-2 border-blue-500"></div>
                  <div className="absolute -bottom-2 -left-2 w-4 h-4 border-b-2 border-l-2 border-blue-500"></div>
                  <div className="absolute -bottom-2 -right-2 w-4 h-4 border-b-2 border-r-2 border-blue-500"></div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Manual Input & Result */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-6">
          <div>
            <h4 className="font-medium text-slate-800 mb-3">Input Manual QR Code</h4>
            <form onSubmit={handleManualSubmit} className="space-y-3">
              <input
                type="text"
                value={manualQr}
                onChange={(e) => setManualQr(e.target.value.toUpperCase())}
                placeholder="Masukkan kode QR (contoh: SEMINAR-ABC123)"
                className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm font-mono tracking-wider focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none uppercase"
              />
              <button
                type="submit"
                className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors"
              >
                Verifikasi Kode
              </button>
            </form>
          </div>

          <div className="border-t border-slate-200 pt-6">
            <h4 className="font-medium text-slate-800 mb-4">Hasil Verifikasi</h4>
            {result ? (
              <div className={`p-4 rounded-xl ${result.success ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${result.success ? "bg-green-100" : "bg-red-100"}`}>
                    {result.success ? (
                      <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <p className={`font-medium ${result.success ? "text-green-800" : "text-red-800"}`}>{result.message}</p>
                    {result.participant && (
                      <p className="text-sm text-slate-500 mt-1">
                        {result.participant.institution} • {result.participant.profession}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500">
                <p className="mb-2">Hasil verifikasi akan muncul di sini</p>
                <p className="text-sm">Scan QR code atau masukkan kode manual</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Attendance */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="font-semibold text-slate-800">Presensi Terbaru (QR Code)</h3>
        </div>
        <div className="divide-y divide-slate-100">
          {registrations
            .filter((r) => r.isPresent && r.presentMethod === "qr")
            .slice(0, 10)
            .map((reg) => (
              <div key={reg.id} className="px-6 py-4 hover:bg-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-slate-800">{reg.fullName}</p>
                    <p className="text-sm text-slate-500">{reg.institution} • {reg.profession}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-700">Hadir</span>
                  <p className="text-xs text-slate-500 mt-1">{reg.presentTime ? new Date(reg.presentTime).toLocaleString("id-ID") : ""}</p>
                </div>
              </div>
            ))}
          {registrations.filter((r) => r.isPresent && r.presentMethod === "qr").length === 0 && (
            <div className="px-6 py-8 text-center text-slate-500">
              Belum ada presensi via QR Code
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Manual Code Tab
function ManualCodeTab({ seminarId, registrations, onUpdate, onSwitchTab }: { seminarId: string; registrations: Registration[]; onUpdate: () => void; onSwitchTab: (tab: "face" | "qr" | "code") => void }) {
  const [code, setCode] = useState("");
  const [result, setResult] = useState<{ success: boolean; message: string; participant?: Registration } | null>(null);
  const [searchResults, setSearchResults] = useState<Registration[]>([]);
  const [searching, setSearching] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    
    setSearching(true);
    try {
      const res = await fetch(`/api/attendance/code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seminarId, code: code.trim().toUpperCase() }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult({ success: true, message: `Presensi berhasil untuk ${data.participant.fullName}`, participant: data.participant });
        onUpdate();
      } else {
        setResult({ success: false, message: data.error || "Kode presensi tidak valid" });
      }
    } catch {
      setResult({ success: false, message: "Gagal memverifikasi kode" });
    } finally {
      setSearching(false);
    }
  };

  const handleNameSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    
    setSearching(true);
    try {
      const res = await fetch(`/api/registrations?seminarId=${seminarId}&search=${encodeURIComponent(code.trim())}`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data);
      }
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
            <CodeIcon className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <h3 className="font-semibold text-amber-800">Input Kode Presensi Manual</h3>
            <p className="text-sm text-amber-600">Masukkan kode presensi yang diberikan kepada peserta</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Code Input */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6">
          <form onSubmit={handleSearch} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Kode Presensi</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="Contoh: PRS-2024-ABC123"
                className="w-full px-4 py-4 border border-slate-300 rounded-xl text-lg font-mono tracking-wider focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none uppercase"
                autoComplete="off"
                disabled={searching}
              />
            </div>
            <button
              type="submit"
              disabled={searching || !code.trim()}
              className="w-full py-4 bg-amber-600 text-white font-semibold rounded-xl hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-lg"
            >
              {searching ? "Memverifikasi..." : "Verifikasi & Presensi"}
            </button>
          </form>

          <div className="border-t border-slate-200 pt-4">
            <label className="block text-sm font-semibold text-slate-700 mb-2">Atau Presensi dengan Face ID</label>
            <p className="text-sm text-slate-500 mb-3">Gunakan kamera untuk verifikasi wajah peserta</p>
            <button
              type="button"
              onClick={() => onSwitchTab("face")}
              className="w-full py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Buka Face ID
            </button>
          </div>
        </div>

        {/* Result */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h4 className="font-medium text-slate-800 mb-4">Hasil Verifikasi</h4>
          {result ? (
            <div className={`p-4 rounded-xl ${result.success ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${result.success ? "bg-green-100" : "bg-red-100"}`}>
                  {result.success ? (
                    <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                </div>
                <div>
                  <p className={`font-medium ${result.success ? "text-green-800" : "text-red-800"}`}>{result.message}</p>
                  {result.participant && (
                    <p className="text-sm text-slate-500 mt-1">
                      {result.participant.institution} • {result.participant.profession}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500">
              <p className="mb-2">Hasil verifikasi akan muncul di sini</p>
              <p className="text-sm">Masukkan kode presensi atau cari nama peserta</p>
            </div>
          )}
        </div>
      </div>

      {/* Recent Attendance */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="font-semibold text-slate-800">Presensi Terbaru (Kode Manual)</h3>
        </div>
        <div className="divide-y divide-slate-100">
          {registrations
            .filter((r) => r.isPresent && r.presentMethod === "code")
            .slice(0, 10)
            .map((reg) => (
              <div key={reg.id} className="px-6 py-4 hover:bg-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-slate-800">{reg.fullName}</p>
                    <p className="text-sm text-slate-500">{reg.institution} • {reg.profession}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="px-2 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-700">Hadir</span>
                  <p className="text-xs text-slate-500 mt-1">{reg.presentTime ? new Date(reg.presentTime).toLocaleString("id-ID") : ""}</p>
                </div>
              </div>
            ))}
          {registrations.filter((r) => r.isPresent && r.presentMethod === "code").length === 0 && (
            <div className="px-6 py-8 text-center text-slate-500">
              Belum ada presensi via Kode Manual
            </div>
          )}
        </div>
      </div>
    </div>
  );
}