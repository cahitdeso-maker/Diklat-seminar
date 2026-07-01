"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function AdminDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState({
    seminars: 0,
    participants: 0,
    present: 0,
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [semRes, regRes] = await Promise.all([
        fetch("/api/seminars"),
        fetch("/api/registrations"),
      ]);

      if (!semRes.ok || !regRes.ok) {
        throw new Error(`API error: ${semRes.status} ${regRes.status}`);
      }

      const seminars = await semRes.json();
      const registrations = await regRes.json();

      const allRegs = Array.isArray(registrations) ? registrations : [];
      setStats({
        seminars: Array.isArray(seminars) ? seminars.length : 0,
        participants: allRegs.length,
        present: allRegs.filter((r: any) => r.isPresent).length,
      });
    } catch (e) {
      console.error("Failed to load stats", e);
      setError(
        "Gagal memuat data dashboard. Pastikan Anda sudah login dan database tersambung.",
      );
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard Admin</h1>
        <p className="text-sm text-gray-500 mt-1">
          Sistem Presensi Seminar — Bagian Diklat RS PKU Muhammadiyah Gombong
        </p>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-5 py-4 rounded-xl text-sm">
          {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-2xl p-5 shadow-lg shadow-slate-200/50">
          <p className="text-3xl font-bold text-blue-700">{stats.seminars}</p>
          <p className="text-sm text-slate-500">Total Seminar</p>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-lg shadow-slate-200/50">
          <p className="text-3xl font-bold text-emerald-700">
            {stats.participants}
          </p>
          <p className="text-sm text-slate-500">Peserta Terdaftar</p>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-lg shadow-slate-200/50">
          <p className="text-3xl font-bold text-green-700">{stats.present}</p>
          <p className="text-sm text-slate-500">Hadir</p>
        </div>
      </div>

      {/* Menu */}
      <div className="grid md:grid-cols-3 gap-6">
        <Link
          href="/admin/seminars"
          className="bg-white rounded-2xl p-6 shadow-lg shadow-slate-200/50 hover:shadow-2xl transition-all"
        >
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4">
            <svg
              className="w-6 h-6 text-blue-600"
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
          <h3 className="font-semibold text-gray-900">Kelola Seminar</h3>
          <p className="text-sm text-gray-500">Tambah & atur seminar</p>
        </Link>

        <Link
          href="/admin/participants"
          className="bg-white rounded-2xl p-6 shadow-lg shadow-slate-200/50 hover:shadow-2xl transition-all"
        >
          <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mb-4">
            <svg
              className="w-6 h-6 text-green-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </div>
          <h3 className="font-semibold text-gray-900">Peserta</h3>
          <p className="text-sm text-gray-500">
            Lihat daftar peserta & presensi
          </p>
        </Link>

        <Link
          href="/presensi"
          className="bg-white rounded-2xl p-6 shadow-lg shadow-slate-200/50 hover:shadow-2xl transition-all"
        >
          <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mb-4">
            <svg
              className="w-6 h-6 text-purple-600"
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
          <h3 className="font-semibold text-gray-900">Presensi QR</h3>
          <p className="text-sm text-gray-500">Scan QR peserta</p>
        </Link>
      </div>
    </div>
  );
}
