"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";

export default function Home() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((res) => {
        if (res.ok) setIsLoggedIn(true);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-indigo-900 flex flex-col">
      {/* Header with App Info */}
      <header className="px-6 py-4 text-white flex items-center gap-3">
        <div className="w-10 h-10 flex items-center justify-center bg-white bg-opacity-20 rounded-lg">
          <svg
            className="w-6 h-6"
            fill="white"
            viewBox="0 0 24 24"
            stroke="none"
          >
            <path d="M12 2a10 10 0 017.07 17.07 1 1 0 01-1.42 1.42A12 12 0 0012 0a12 12 0 00-8.63 3.51 1 1 0 011.42-1.42A10 10 0 0112 2zm0 8a1 1 0 011 1v4m0 4h.01" />
          </svg>
        </div>
        <div>
          <h1 className="text-xl font-bold">Presensi Medis</h1>
          <p className="text-sm text-blue-200">Smart Attendance System</p>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 pb-20">
        <div className="w-full max-w-md">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-white mb-2">Welcome to</h2>
            <h1 className="text-4xl font-bold text-white mb-4">
              <span className="text-blue-300">Presensi</span> Pintar
            </h1>
            <p className="text-blue-200 text-sm max-w-xs mx-auto">
              Sistem presensi cerdas untuk mahasiswa praktik di rumah sakit
            </p>
          </div>

          <div className="space-y-6">
            <Link
              href="/mahasiswa/register"
              className="block w-full bg-white text-blue-900 font-semibold py-3 px-4 rounded-full text-center shadow-lg hover:bg-opacity-90 transition"
            >
              Daftar Praktik
            </Link>
            <Link
              href="/mahasiswa/attendance"
              className="block w-full border-2 border-white text-white font-semibold py-3 px-4 rounded-full text-center hover:bg-white hover:bg-opacity-10 transition"
            >
              Presensi Sekarang
            </Link>
            <Link
              href="/admin/login"
              className="block w-full bg-blue-700 text-white font-semibold py-3 px-4 rounded-full text-center hover:bg-blue-600 transition"
            >
              Login Admin
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-6">
        <div className="max-w-6xl mx-auto px-4 text-center text-sm text-gray-500">
          &copy; {new Date().getFullYear()} Presensi Medis Pintar - Bagian
          Diklat Rumah Sakit
        </div>
      </footer>
    </div>
  );
}
