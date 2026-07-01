"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function ParticipantsPage() {
  const [seminars, setSeminars] = useState<any[]>([]);
  const [selectedSeminarId, setSelectedSeminarId] = useState("");
  const [participants, setParticipants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetch("/api/seminars?active=false")
      .then((r) => r.ok && r.json())
      .then((d) => {
        setSeminars(d || []);
        const params = new URLSearchParams(window.location.search);
        const semId = params.get("seminarId");
        if (semId) {
          setSelectedSeminarId(semId);
          loadParticipants(semId);
        } else {
          setLoading(false);
        }
      });
  }, []);

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

  // Filter participants by search query
  const filteredParticipants = participants.filter((p: any) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.fullName?.toLowerCase().includes(q) ||
      p.email?.toLowerCase().includes(q) ||
      p.institution?.toLowerCase().includes(q) ||
      p.profession?.toLowerCase().includes(q)
    );
  });

  const togglePresent = async (id: string, isPresent: boolean) => {
    await fetch(`/api/registrations?id=${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPresent: !isPresent, presentMethod: "manual" }),
    });
    loadParticipants(selectedSeminarId);
  };

  const sendCertificateWa = async (registrationId: string) => {
    setSendingId(registrationId);
    try {
      const res = await fetch("/api/certificates/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registrationId }),
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        loadParticipants(selectedSeminarId);
      } else {
        alert(data.error || "Gagal mengirim sertifikat");
      }
    } catch {
      alert("Gagal terhubung ke server");
    } finally {
      setSendingId(null);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Daftar Peserta</h1>
        <p className="text-sm text-gray-500 mt-1">
          Lihat & kelola peserta seminar
        </p>
      </div>

      <div className="mb-6">
        <select
          value={selectedSeminarId}
          onChange={(e) => {
            setSelectedSeminarId(e.target.value);
            if (e.target.value) loadParticipants(e.target.value);
          }}
          className="w-full max-w-md px-4 py-3 border border-slate-300 rounded-xl text-sm focus:border-blue-400 outline-none"
        >
          <option value="">-- Pilih Seminar --</option>
          {seminars.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title} - {s.date}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
        </div>
      ) : !selectedSeminarId ? (
        <div className="text-center py-12 text-slate-400">
          Pilih seminar untuk melihat peserta
        </div>
      ) : participants.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          Belum ada peserta terdaftar
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 overflow-hidden">
          {/* Search Input */}
          <div className="p-4 border-b border-slate-200">
            <input
              type="text"
              placeholder="Cari peserta (nama, email, institusi, profesi)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full md:w-96 px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
            />
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 font-semibold text-slate-700">
                  Nama
                </th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">
                  Email
                </th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">
                  Institusi
                </th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">
                  Profesi
                </th>
                <th className="text-center px-4 py-3 font-semibold text-slate-700">
                  Presensi
                </th>
                <th className="text-center px-4 py-3 font-semibold text-slate-700">
                  Waktu
                </th>
                <th className="text-center px-4 py-3 font-semibold text-slate-700">
                  Sertifikat
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredParticipants.map((p: any) => (
                <tr
                  key={p.id}
                  className="border-b border-slate-100 hover:bg-slate-50"
                >
                  <td className="px-4 py-3 font-medium">{p.fullName}</td>
                  <td className="px-4 py-3 text-slate-500">{p.email || "-"}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {p.institution || "-"}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {p.profession || "-"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => togglePresent(p.id, p.isPresent)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold ${p.isPresent ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}
                    >
                      {p.isPresent ? "Hadir" : "Belum"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-center text-xs text-slate-400">
                    {p.presentTime
                      ? new Date(p.presentTime).toLocaleTimeString("id-ID", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "-"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => sendCertificateWa(p.id)}
                      disabled={sendingId === p.id}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold ${p.certificateSent ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700 hover:bg-blue-200"} disabled:opacity-50 transition-all`}
                      title={
                        p.certificateSent
                          ? "Sudah dikirim"
                          : "Kirim sertifikat via WhatsApp"
                      }
                    >
                      {sendingId === p.id
                        ? "Mengirim..."
                        : p.certificateSent
                          ? "✓ Terkirim"
                          : "📤 Kirim"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
