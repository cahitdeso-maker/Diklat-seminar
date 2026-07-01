"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";

export default function AttendancePage() {
  const [step, setStep] = useState<"id" | "camera" | "location" | "result">(
    "id",
  );
  const [studentId, setStudentId] = useState("");
  const [studentName, setStudentName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    message: string;
    attendance: {
      time: string;
      shift: string;
      isLate: boolean;
      distance: number;
      unitName: string;
    };
  } | null>(null);
  const [photoData, setPhotoData] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Check localStorage for saved student ID
  useEffect(() => {
    const savedId = localStorage.getItem("studentId");
    if (savedId) {
      setStudentId(savedId);
    }
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 320, height: 240 },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch {
      setError("Tidak dapat mengakses kamera. Periksa izin kamera.");
    }
  };

  const capturePhoto = () => {
    if (canvasRef.current && videoRef.current) {
      const context = canvasRef.current.getContext("2d");
      canvasRef.current.width = videoRef.current.videoWidth;
      canvasRef.current.height = videoRef.current.videoHeight;
      context?.drawImage(
        videoRef.current,
        0,
        0,
        canvasRef.current.width,
        canvasRef.current.height,
      );
      const dataUrl = canvasRef.current.toDataURL("image/jpeg", 0.8);
      setPhotoData(dataUrl);

      // Stop camera
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      setStep("location");
      getLocation();
    }
  };

  const getLocation = () => {
    if (!navigator.geolocation) {
      setError("Geolokasi tidak didukung browser Anda.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        submitAttendance(position.coords.latitude, position.coords.longitude);
      },
      () => {
        // If geolocation fails, still try with approximate location
        setError("Gagal mendapatkan lokasi. Periksa izin lokasi.");
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const submitAttendance = async (latitude: number, longitude: number) => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: studentId,
          latitude: latitude.toString(),
          longitude: longitude.toString(),
          photoProof: photoData,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setResult(data);
        setStep("result");
      } else {
        setError(data.error || "Presensi gagal");
      }
    } catch {
      setError("Terjadi kesalahan jaringan");
    } finally {
      setLoading(false);
    }
  };

  const handleStartAttendance = async () => {
    if (!studentId.trim()) {
      setError("Masukkan ID mahasiswa");
      return;
    }

    // Verify student exists
    try {
      const res = await fetch(`/api/students/${studentId}`);
      if (res.ok) {
        const data = await res.json();
        setStudentName(data.fullName);
        localStorage.setItem("studentId", studentId);
        setStep("camera");
        startCamera();
      } else {
        setError("Mahasiswa tidak ditemukan. Silakan daftar terlebih dahulu.");
      }
    } catch {
      setError("Gagal memverifikasi data mahasiswa");
    }
  };

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-6">
          <Link href="/" className="text-blue-600 text-sm hover:underline">
            &larr; Kembali
          </Link>
          <h2 className="text-2xl font-bold text-gray-900 mt-2">
            Presensi Harian
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Lakukan verifikasi wajah dan lokasi untuk presensi
          </p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm mb-4">
            {error}
          </div>
        )}

        {step === "id" && (
          <div className="card">
            <label className="label">ID Mahasiswa</label>
            <input
              type="text"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              className="input mb-4"
              placeholder="Masukkan ID mahasiswa"
            />
            <button
              onClick={handleStartAttendance}
              className="btn btn-primary w-full py-3"
            >
              Mulai Presensi
            </button>
            <p className="text-xs text-gray-500 mt-3 text-center">
              Belum punya ID?{" "}
              <Link
                href="/mahasiswa/register"
                className="text-blue-600 hover:underline"
              >
                Daftar di sini
              </Link>
            </p>
          </div>
        )}

        {step === "camera" && (
          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-2">
              Verifikasi Wajah
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Arahkan wajah Anda ke kamera dan klik tombol di bawah
            </p>
            <div className="bg-black rounded-lg overflow-hidden mb-4">
              <video ref={videoRef} autoPlay playsInline className="w-full" />
            </div>
            <canvas ref={canvasRef} className="hidden" />
            <button onClick={capturePhoto} className="btn btn-primary w-full">
              Ambil Foto & Presensi
            </button>
          </div>
        )}

        {step === "location" && (
          <div className="card text-center">
            <div className="animate-spin w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
            <h3 className="font-semibold text-gray-900 mb-2">
              Mendeteksi Lokasi
            </h3>
            <p className="text-sm text-gray-600">
              Memeriksa posisi GPS Anda...
            </p>
          </div>
        )}

        {step === "result" && result && (
          <div className="card text-center">
            <div
              className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
                result.attendance.isLate ? "bg-yellow-100" : "bg-green-100"
              }`}
            >
              <svg
                className={`w-8 h-8 ${
                  result.attendance.isLate
                    ? "text-yellow-600"
                    : "text-green-600"
                }`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              {result.message}
            </h3>
            <div className="bg-gray-50 rounded-lg p-4 text-left space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Shift</span>
                <span className="font-medium">{result.attendance.shift}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Waktu</span>
                <span className="font-medium">
                  {new Date(result.attendance.time).toLocaleTimeString("id-ID")}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Unit</span>
                <span className="font-medium">
                  {result.attendance.unitName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Jarak</span>
                <span className="font-medium">
                  {result.attendance.distance}m
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Status</span>
                <span
                  className={`badge ${
                    result.attendance.isLate ? "badge-danger" : "badge-success"
                  }`}
                >
                  {result.attendance.isLate ? "Terlambat" : "Tepat Waktu"}
                </span>
              </div>
            </div>
            <div className="flex gap-3 mt-4 justify-center">
              <Link href="/" className="btn btn-outline">
                Beranda
              </Link>
              <Link href="/mahasiswa/certificate" className="btn btn-primary">
                Lihat Sertifikat
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
