"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function AdminDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState({
    seminars: 0,
    activeSeminars: 0,
    participants: 0,
    present: 0,
    absent: 0,
  });
  const [recentSeminars, setRecentSeminars] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Fetch ALL seminars (including completed) for Total Seminar count
      const allSemRes = await fetch("/api/seminars?active=false", { credentials: "include" });
      
      if (!allSemRes.ok) {
        throw new Error(`API error: ${allSemRes.status}`);
      }

      const allSeminarsData = await allSemRes.json();
      const allSeminars = Array.isArray(allSeminarsData) ? allSeminarsData : [];
      
      // Fetch active seminars (not completed, not deleted) for other stats
      const activeSemRes = await fetch("/api/seminars?active=true", { credentials: "include" });
      const activeSeminarsData = await activeSemRes.json();
      const activeSeminars = Array.isArray(activeSeminarsData) ? activeSeminarsData : [];
      
      // Get active seminar IDs
      const activeSeminarIds = activeSeminars.map((s: any) => s.id);
      
      // Fetch ALL registrations (from all seminars) for Peserta Terdaftar
      const allRegRes = await fetch("/api/registrations", { credentials: "include" });
      let allRegistrations: any[] = [];
      if (allRegRes.ok) {
        const registrations = await allRegRes.json();
        allRegistrations = Array.isArray(registrations) ? registrations : [];
        // Filter out deleted registrations
        allRegistrations = allRegistrations.filter((r: any) => !r.isDeleted);
      }

      // Filter registrations for active seminars that haven't started yet (startDate > now)
      const now = new Date();
      const upcomingActiveSeminars = activeSeminars.filter((s: any) => new Date(s.startDate) > now);
      const upcomingActiveSeminarIds = upcomingActiveSeminars.map((s: any) => s.id);
      
      const upcomingRegistrations = allRegistrations.filter((r: any) => 
        upcomingActiveSeminarIds.includes(r.seminarId)
      );

      setStats({
        seminars: allSeminars.length, // Total Seminar = ALL seminars (active + completed)
        activeSeminars: activeSeminars.length, // Active seminars only
        participants: upcomingRegistrations.length, // Participants from active seminars not yet started
        present: allRegistrations.filter((r: any) => r.isPresent).length, // Hadir from ALL seminars
        absent: allRegistrations.filter((r: any) => !r.isPresent).length, // Belum Hadir from ALL seminars
      });

      // Get recent 5 active seminars (sorted by creation date)
      const sortedSeminars = [...activeSeminars].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setRecentSeminars(sortedSeminars.slice(0, 5));
    } catch (e) {
      console.error("Failed to load stats", e);
      setError(
        "Gagal memuat data dashboard. Pastikan Anda sudah login dan database tersambung.",
      );
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const getStatusBadge = (seminar: any) => {
    const now = new Date();
    const start = new Date(seminar.startDate);
    const end = new Date(seminar.endDate);
    
    if (now < start) return { label: "Akan Datang", class: "bg-blue-100 text-blue-700" };
    if (now > end) return { label: "Selesai", class: "bg-gray-100 text-gray-700" };
    return { label: "Sedang Berlangsung", class: "bg-green-100 text-green-700" };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="animate-spin w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  const statCards = [
    {
      title: "Total Seminar",
      value: stats.seminars,
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
      gradient: "from-blue-500 to-blue-600",
      bg: "bg-blue-50",
      textColor: "text-blue-700",
      trend: "+12% dari bulan lalu",
      trendColor: "text-green-600",
    },
    {
      title: "Peserta Terdaftar",
      value: stats.participants,
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      gradient: "from-emerald-500 to-emerald-600",
      bg: "bg-emerald-50",
      textColor: "text-emerald-700",
      trend: "+8% dari minggu lalu",
      trendColor: "text-green-600",
    },
    {
      title: "Hadir",
      value: stats.present,
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      gradient: "from-green-500 to-green-600",
      bg: "bg-green-50",
      textColor: "text-green-700",
      trend: stats.participants > 0 ? `${Math.round((stats.present / stats.participants) * 100)}% kehadiran` : "0% kehadiran",
      trendColor: "text-green-600",
    },
    {
      title: "Belum Hadir",
      value: stats.absent,
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      gradient: "from-amber-500 to-amber-600",
      bg: "bg-amber-50",
      textColor: "text-amber-700",
      trend: "Perlu follow up",
      trendColor: "text-amber-600",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200/50">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-800">Dashboard Admin</h1>
                <p className="text-xs text-slate-500">Bagian Diklat RS PKU Muhammadiyah Gombong</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-full">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-xs font-medium text-slate-600">Online</span>
              </div>
              <button className="p-2 rounded-xl hover:bg-slate-100 transition-colors">
                <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </button>
              <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center text-white font-semibold text-sm">
                AD
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-5 py-4 rounded-xl text-sm flex items-center gap-2">
            <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            {error}
          </div>
        )}

        {/* Welcome Section */}
        <div className="mb-8">
          <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-2xl p-6 sm:p-8 text-white relative overflow-hidden">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=%2260%22 height=%2260%22 viewBox=%220 0 60 60%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cg fill=%22none%22 fill-rule=%22evenodd%22%3E%3Cg fill=%22%23ffffff%22 fill-opacity=%220.05%22%3E%3Cpath d=%22M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 36v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 6V0H4v4H0v2h4v4h2V6h4V4H6z%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-50" />
            <div className="absolute top-0 right-0 w-72 h-72 bg-white/10 rounded-full blur-3xl -translate-x-1/2 translate-y-1/2" />
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-white/5 rounded-full blur-3xl translate-x-1/2 -translate-y-1/2" />
            
            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <p className="text-blue-100 text-sm font-medium uppercase tracking-wider mb-1">Selamat Datang Kembali</p>
                <h2 className="text-2xl sm:text-3xl font-bold">Admin Diklat RS</h2>
                <p className="text-blue-100/80 mt-2 max-w-md">Kelola seminar, peserta, dan presensi dengan mudah dan efisien</p>
              </div>
              <div className="flex items-center gap-4 pt-4 sm:pt-0 border-t border-white/10 sm:border-t-0 sm:border-l sm:pl-6">
                <div className="text-center">
                  <p className="text-3xl font-bold">{stats.activeSeminars}</p>
                  <p className="text-blue-100/70 text-sm">Seminar Aktif</p>
                </div>
                <div className="w-px h-12 bg-white/20 hidden sm:block"></div>
                <div className="text-center">
                  <p className="text-3xl font-bold">{stats.participants}</p>
                  <p className="text-blue-100/70 text-sm">Total Peserta</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {statCards.map((card, index) => (
            <div key={index} className="group bg-white rounded-2xl p-5 shadow-lg shadow-slate-200/50 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 border border-slate-100">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{card.title}</p>
                  <p className="text-3xl font-bold text-slate-800">{card.value}</p>
                  <p className={`${card.trendColor} text-xs font-medium mt-1`}>{card.trend}</p>
                </div>
                <div className={`${card.bg} ${card.textColor} p-3 rounded-xl group-hover:scale-110 transition-transform`}>
                  {card.icon}
                </div>
              </div>
              <div className="mt-4 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r rounded-full transition-all duration-500"
                  style={{ 
                    width: card.title === "Hadir" && stats.participants > 0 
                      ? `${(stats.present / stats.participants) * 100}%` 
                      : card.title === "Belum Hadir" && stats.participants > 0
                      ? `${(stats.absent / stats.participants) * 100}%`
                      : "0%"
                  }}
                ></div>
              </div>
            </div>
          ))}
        </div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Recent Seminars */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-lg shadow-slate-200/50 border border-slate-100 overflow-hidden">
              <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                    <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-800">Seminar Terbaru</h3>
                    <p className="text-xs text-slate-500">{recentSeminars.length} seminar terakhir</p>
                  </div>
                </div>
                <Link
                  href="/admin/seminars"
                  className="text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                  Lihat Semua
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>

              <div className="divide-y divide-slate-100">
                {recentSeminars.length > 0 ? (
                  recentSeminars.map((seminar: any) => {
                    const status = getStatusBadge(seminar);
                    return (
                      <Link
                        key={seminar.id}
                        href={`/admin/seminars/${seminar.id}`}
                        className="p-5 hover:bg-slate-50 transition-colors flex items-center justify-between group"
                      >
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-medium text-slate-800 truncate">{seminar.title}</h4>
                            <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
                              <span className="flex items-center gap-1">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                {formatDate(seminar.startDate)} - {formatDate(seminar.endDate)}
                              </span>
                              <span className="flex items-center gap-1">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                {seminar.location}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 ml-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${status.class}`}>
                            {status.label}
                          </span>
                          <svg className="w-5 h-5 text-slate-300 group-hover:text-slate-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </Link>
                    );
                  })
                ) : (
                  <div className="p-12 text-center">
                    <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                    <h4 className="text-slate-600 font-medium">Belum ada seminar</h4>
                    <p className="text-slate-400 text-sm mt-1">Mulai buat seminar pertama Anda</p>
                    <Link
                      href="/admin/seminars"
                      className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Buat Seminar
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-lg shadow-slate-200/50 border border-slate-100 p-5">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center">
                  <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800">Aksi Cepat</h3>
                  <p className="text-xs text-slate-500">Menu utama yang sering digunakan</p>
                </div>
              </div>
              <div className="space-y-3">
                <Link
                  href="/admin/seminars"
                  className="flex items-center gap-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl hover:from-blue-100 hover:to-indigo-100 transition-all group"
                >
                  <div className="w-11 h-11 bg-white rounded-xl flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
                    <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-slate-800">Buat Seminar Baru</p>
                    <p className="text-xs text-slate-500">Tambah seminar & jadwal</p>
                  </div>
                  <svg className="w-5 h-5 text-slate-300 group-hover:text-blue-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>

                <Link
                  href="/admin/participants"
                  className="flex items-center gap-4 p-4 bg-gradient-to-r from-emerald-50 to-green-50 rounded-xl hover:from-emerald-100 hover:to-green-100 transition-all group"
                >
                  <div className="w-11 h-11 bg-white rounded-xl flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
                    <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-slate-800">Kelola Peserta</p>
                    <p className="text-xs text-slate-500">Lihat & edit daftar peserta</p>
                  </div>
                  <svg className="w-5 h-5 text-slate-300 group-hover:text-emerald-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>

                <Link
                  href="/presensi"
                  className="flex items-center gap-4 p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl hover:from-purple-100 hover:to-pink-100 transition-all group"
                >
                  <div className="w-11 h-11 bg-white rounded-xl flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
                    <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-slate-800">Presensi QR Code</p>
                    <p className="text-xs text-slate-500">Scan QR untuk kehadiran</p>
                  </div>
                  <svg className="w-5 h-5 text-slate-300 group-hover:text-purple-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>

                <Link
                  href="/admin/reports"
                  className="flex items-center gap-4 p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl hover:from-amber-100 hover:to-orange-100 transition-all group"
                >
                  <div className="w-11 h-11 bg-white rounded-xl flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
                    <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-slate-800">Laporan & Ekspor</p>
                    <p className="text-xs text-slate-500">Download laporan kehadiran</p>
                  </div>
                  <svg className="w-5 h-5 text-slate-300 group-hover:text-amber-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white/50 backdrop-blur-sm border-t border-slate-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <p className="text-center text-sm text-slate-500">
            &copy; {new Date().getFullYear()} Diklat RS PKU Muhammadiyah Gombong. Sistem Presensi Medis Pintar.
          </p>
        </div>
      </footer>
    </div>
  );
}