"use client";

import { useState, useEffect } from "react";
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

interface Participant {
  id: string;
  fullName: string;
  email: string | null;
  phoneNumber: string | null;
  institution: string | null;
  profession: string | null;
  isPresent: boolean;
  presentTime: string | null;
  presentMethod: string | null;
}

export default function CheckInPage() {
  const [seminars, setSeminars] = useState<Seminar[]>([]);
  const [selectedSeminarId, setSelectedSeminarId] = useState("");
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    loadSeminars();
  }, []);

  const loadSeminars = async () => {
    try {
      const res = await fetch("/api/seminars?active=true");
      if (res.ok) {
        const data = await res.json();
        setSeminars(data || []);
        const params = new URLSearchParams(window.location.search);
        const semId = params.get("seminarId");
        if (semId) {
          setSelectedSeminarId(semId);
          loadParticipants(semId);
        } else {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    } catch {
      setLoading(false);
    }
  };

  const loadParticipants = async (seminarId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/registrations?seminarId=${seminarId}`);
      if (res.ok) setParticipants(await res.json());
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const filteredParticipants = participants.filter((p) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.fullName?.toLowerCase().includes(q) ||
      p.email?.toLowerCase().includes(q) ||
      p.institution?.toLowerCase().includes(q) ||
      p.profession?.toLowerCase().includes(q)
    );
  });

  const presentCount = participants.filter((p) => p.isPresent).length;
  const totalCount = participants.length;

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Check-In Peserta</h1>
        <p className="text-sm text-gray-500 mt-1">
          Pantau status presensi / daftar hadir peserta
        </p>
      </div>

      {/* Seminar Selector */}
      <div className="mb-6">
        <select
          value={selectedSeminarId}
          onChange={(e) => {
            setSelectedSeminarId(e.target.value);
            if (e.target.value) loadParticipants(e.target.value);
          }}
          className="w-full max-w-md px-4 py-3 border border-slate-300 rounded-xl text-sm focus:border-emerald-400 outline-none"
        >
          <option value="">-- Pilih Seminar --</option>
          {seminars.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title} - {s.date}
              {s.useManual ? " 📋" : ""}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full mx-auto"></div>
        </div>
      ) : !selectedSeminarId ? (
        <div className="text-center py-12 text-slate-400">
          Pilih seminar untuk melihat status check-in peserta
        </div>
      ) : participants.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          Belum ada peserta terdaftar
        </div>
      ) : (
        <>
          {/* Info Seminar */}
          {(() => {
            const sem = seminars.find((s) => s.id === selectedSeminarId);
            return sem ? (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl flex items-center justify-center">
                    <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-slate-800">{sem.title}</h3>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {new Date(sem.date).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                      </span>
                      {sem.startTime && (
                        <span className="flex items-center gap-1">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {sem.startTime}{sem.endTime ? ` - ${sem.endTime}` : ""}
                        </span>
                      )}
                      {sem.location && (
                        <span className="flex items-center gap-1">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          {sem.location}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : null;
          })()}

          {/* Stats Cards */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 text-center">
              <div className="text-3xl font-bold text-emerald-600">{presentCount}</div>
              <div className="text-xs text-slate-500 mt-1">Checked-In</div>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 text-center">
              <div className="text-3xl font-bold text-slate-600">{totalCount}</div>
              <div className="text-xs text-slate-500 mt-1">Total Peserta</div>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 text-center">
              <div className="text-3xl font-bold text-amber-600">{totalCount - presentCount}</div>
              <div className="text-xs text-slate-500 mt-1">Belum Check-In</div>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center gap-3">
              <input
                type="text"
                placeholder="Cari peserta..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 max-w-md px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:border-emerald-400 focus:ring-2 focus:ring-emerald-50 outline-none transition-all"
              />
              <Link
                href={`/presensi/manual/${selectedSeminarId}`}
                target="_blank"
                className="px-4 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 transition-all shadow-sm flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Buka Daftar Hadir
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-4 py-3 font-semibold text-slate-700">Nama</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-700">Institusi</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-700">Profesi</th>
                    <th className="text-center px-4 py-3 font-semibold text-slate-700">Status</th>
                    <th className="text-center px-4 py-3 font-semibold text-slate-700">Metode</th>
                    <th className="text-center px-4 py-3 font-semibold text-slate-700">Waktu Check-In</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredParticipants.map((p) => (
                    <tr
                      key={p.id}
                      className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${
                        p.isPresent ? "bg-emerald-50/30" : ""
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${
                            p.isPresent ? "bg-emerald-500" : "bg-slate-300"
                          }`}></div>
                          <span className="font-medium text-slate-800">{p.fullName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{p.institution || "-"}</td>
                      <td className="px-4 py-3 text-slate-500">{p.profession || "-"}</td>
                      <td className="px-4 py-3 text-center">
                        {p.isPresent ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-full">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Checked-In
                          </span>
                        ) : (
                          <span className="px-3 py-1 bg-slate-100 text-slate-500 text-xs font-semibold rounded-full">
                            Belum
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {p.presentMethod ? (
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            p.presentMethod === "manual"
                              ? "bg-emerald-100 text-emerald-700"
                              : p.presentMethod === "face"
                              ? "bg-purple-100 text-purple-700"
                              : "bg-blue-100 text-blue-700"
                          }`}>
                            {p.presentMethod === "manual" ? "Daftar Hadir" :
                             p.presentMethod === "face" ? "Face ID" : "QR Code"}
                          </span>
                        ) : (
                          <span className="text-slate-300 text-xs">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center text-xs text-slate-400">
                        {p.presentTime
                          ? new Date(p.presentTime).toLocaleString("id-ID", {
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}