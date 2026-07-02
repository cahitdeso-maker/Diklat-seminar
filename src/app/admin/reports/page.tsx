"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Seminar {
  id: string;
  title: string;
  date: string;
  location: string | null;
  isCompleted: boolean;
}

interface Registration {
  id: string;
  seminarId: string;
  fullName: string;
  email: string | null;
  phoneNumber: string | null;
  institution: string | null;
  profession: string | null;
  isPresent: boolean;
  presentTime: string | null;
  certificateSent: boolean;
}

interface SeminarReport {
  seminar: Seminar;
  totalRegistered: number;
  totalPresent: number;
  totalAbsent: number;
  certificatesSent: number;
  certificatesPending: number;
}

export default function ReportsPage() {
  const [seminars, setSeminars] = useState<Seminar[]>([]);
  const [reports, setReports] = useState<SeminarReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSeminarId, setSelectedSeminarId] = useState<string>("");
  const [detailParticipants, setDetailParticipants] = useState<Registration[]>([]);
  const [showDetail, setShowDetail] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    loadSeminars();
  }, []);

  const loadSeminars = async () => {
    try {
      const res = await fetch("/api/seminars?active=false");
      if (res.ok) {
        const data = await res.json();
        setSeminars(data || []);
        await loadReports(data || []);
      }
    } catch (error) {
      console.error("Failed to load seminars:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadReports = async (seminarList: Seminar[]) => {
    const reportData: SeminarReport[] = [];

    for (const seminar of seminarList) {
      try {
        const res = await fetch(`/api/registrations?seminarId=${seminar.id}`);
        if (res.ok) {
          const participants: Registration[] = await res.json();
          const totalRegistered = participants.length;
          const totalPresent = participants.filter((p) => p.isPresent).length;
          const totalAbsent = totalRegistered - totalPresent;
          const certificatesSent = participants.filter((p) => p.certificateSent).length;
          const certificatesPending = totalRegistered - certificatesSent;

          reportData.push({
            seminar,
            totalRegistered,
            totalPresent,
            totalAbsent,
            certificatesSent,
            certificatesPending,
          });
        }
      } catch (error) {
        console.error(`Failed to load report for seminar ${seminar.id}:`, error);
      }
    }

    setReports(reportData);
  };

  const loadDetailParticipants = async (seminarId: string) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/registrations?seminarId=${seminarId}`);
      if (res.ok) {
        const data = await res.json();
        setDetailParticipants(data || []);
        setShowDetail(true);
      }
    } catch (error) {
      console.error("Failed to load participants:", error);
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setShowDetail(false);
    setDetailParticipants([]);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const getAttendanceRate = (present: number, total: number) => {
    if (total === 0) return 0;
    return Math.round((present / total) * 100);
  };

  const getCertificateRate = (sent: number, total: number) => {
    if (total === 0) return 0;
    return Math.round((sent / total) * 100);
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="animate-spin w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
          <p className="mt-4 text-slate-500">Memuat laporan...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Laporan & Ekspor</h1>
        <p className="text-slate-500 mt-1">
          Ringkasan kehadiran & status sertifikat per seminar
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-2xl shadow-lg shadow-slate-200/50 border border-slate-100 p-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-blue-50 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-slate-500">Total Seminar</p>
              <p className="text-2xl font-bold text-slate-900">{seminars.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg shadow-slate-200/50 border border-slate-100 p-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-green-50 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-slate-500">Total Peserta</p>
              <p className="text-2xl font-bold text-slate-900">
                {reports.reduce((sum, r) => sum + r.totalRegistered, 0)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg shadow-slate-200/50 border border-slate-100 p-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-emerald-50 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-slate-500">Total Hadir</p>
              <p className="text-2xl font-bold text-slate-900">
                {reports.reduce((sum, r) => sum + r.totalPresent, 0)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg shadow-slate-200/50 border border-slate-100 p-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-purple-50 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-slate-500">Sertifikat Terkirim</p>
              <p className="text-2xl font-bold text-slate-900">
                {reports.reduce((sum, r) => sum + r.certificatesSent, 0)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Reports Table */}
      <div className="bg-white rounded-2xl shadow-lg shadow-slate-200/50 border border-slate-100 overflow-hidden">
        <div className="p-5 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-800">Ringkasan Per Seminar</h2>
        </div>

        {reports.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-lg">Belum ada data seminar</p>
            <p className="text-sm mt-1">Buat seminar baru untuk melihat laporan</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-5 py-3 font-semibold text-slate-700">Seminar</th>
                  <th className="text-center px-5 py-3 font-semibold text-slate-700">Tanggal</th>
                  <th className="text-center px-5 py-3 font-semibold text-slate-700">Terdaftar</th>
                  <th className="text-center px-5 py-3 font-semibold text-slate-700">Hadir</th>
                  <th className="text-center px-5 py-3 font-semibold text-slate-700">Tidak Hadir</th>
                  <th className="text-center px-5 py-3 font-semibold text-slate-700">Kehadiran</th>
                  <th className="text-center px-5 py-3 font-semibold text-slate-700">Sertifikat Terkirim</th>
                  <th className="text-center px-5 py-3 font-semibold text-slate-700">Belum Terkirim</th>
                  <th className="text-center px-5 py-3 font-semibold text-slate-700">Status Sertifikat</th>
                  <th className="text-center px-5 py-3 font-semibold text-slate-700">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((report) => (
                  <tr key={report.seminar.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-5 py-4">
                      <div className="font-medium text-slate-900">{report.seminar.title}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{report.seminar.location || "Lokasi tidak ditentukan"}</div>
                    </td>
                    <td className="px-5 py-4 text-center text-slate-600 whitespace-nowrap">
                      {formatDate(report.seminar.date)}
                    </td>
                    <td className="px-5 py-4 text-center font-medium text-slate-900">
                      {report.totalRegistered}
                    </td>
                    <td className="px-5 py-4 text-center font-medium text-green-600">
                      {report.totalPresent}
                    </td>
                    <td className="px-5 py-4 text-center font-medium text-red-600">
                      {report.totalAbsent}
                    </td>
                    <td className="px-5 py-4 text-center">
                      <div className="w-full max-w-xs mx-auto">
                        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-green-500 transition-all"
                            style={{ width: `${getAttendanceRate(report.totalPresent, report.totalRegistered)}%` }}
                          ></div>
                        </div>
                        <div className="text-xs text-slate-500 mt-1 text-center">
                          {getAttendanceRate(report.totalPresent, report.totalRegistered)}%
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-center font-medium text-purple-600">
                      {report.certificatesSent}
                    </td>
                    <td className="px-5 py-4 text-center font-medium text-amber-600">
                      {report.certificatesPending}
                    </td>
                    <td className="px-5 py-4 text-center">
                      <div className="w-full max-w-xs mx-auto">
                        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-purple-500 transition-all"
                            style={{ width: `${getCertificateRate(report.certificatesSent, report.totalRegistered)}%` }}
                          ></div>
                        </div>
                        <div className="text-xs text-slate-500 mt-1 text-center">
                          {getCertificateRate(report.certificatesSent, report.totalRegistered)}%
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <button
                        onClick={() => loadDetailParticipants(report.seminar.id)}
                        className="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-all"
                      >
                        Detail
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {showDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={closeDetail}>
          <div className="bg-white rounded-2xl shadow-xl max-w-6xl w-full max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Detail Peserta</h3>
              <button onClick={closeDetail} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {detailLoading ? (
              <div className="p-12 text-center">
                <div className="animate-spin w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
                <p className="mt-4 text-slate-500">Memuat detail peserta...</p>
              </div>
            ) : (
              <div className="p-5 overflow-y-auto max-h-[60vh]">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 sticky top-0">
                        <th className="text-left px-4 py-3 font-semibold text-slate-700">Nama</th>
                        <th className="text-left px-4 py-3 font-semibold text-slate-700">Email</th>
                        <th className="text-left px-4 py-3 font-semibold text-slate-700">Institusi</th>
                        <th className="text-center px-4 py-3 font-semibold text-slate-700">Profesi</th>
                        <th className="text-center px-4 py-3 font-semibold text-slate-700">Presensi</th>
                        <th className="text-center px-4 py-3 font-semibold text-slate-700">Waktu</th>
                        <th className="text-center px-4 py-3 font-semibold text-slate-700">Sertifikat</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailParticipants.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="text-center py-12 text-slate-400">
                            Belum ada peserta terdaftar
                          </td>
                        </tr>
                      ) : (
                        detailParticipants.map((p) => (
                          <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50">
                            <td className="px-4 py-3 font-medium text-slate-900">{p.fullName}</td>
                            <td className="px-4 py-3 text-slate-500">{p.email || "-"}</td>
                            <td className="px-4 py-3 text-slate-500">{p.institution || "-"}</td>
                            <td className="px-4 py-3 text-center text-slate-500">{p.profession || "-"}</td>
                            <td className="px-4 py-3 text-center">
                              <span className={`px-3 py-1 rounded-lg text-xs font-semibold ${p.isPresent ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                                {p.isPresent ? "Hadir" : "Belum Hadir"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center text-xs text-slate-400">
                              {p.presentTime ? new Date(p.presentTime).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : "-"}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`px-3 py-1 rounded-lg text-xs font-semibold ${p.certificateSent ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                                {p.certificateSent ? "✓ Terkirim" : "⏳ Belum Terkirim"}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}