"use client";

import { useState, useEffect } from "react";

export default function CertificatesPage() {
  const [seminars, setSeminars] = useState<any[]>([]);
  const [selectedSeminarId, setSelectedSeminarId] = useState("");
  const [participants, setParticipants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sendingAll, setSendingAll] = useState(false);
  const [message, setMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetch("/api/seminars?active=false")
      .then((r) => r.ok && r.json())
      .then((d) => {
        setSeminars(d || []);
        setLoading(false);
      });
  }, []);

  const loadParticipants = async (seminarId: string) => {
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch(`/api/registrations?seminarId=${seminarId}`);
      if (res.ok) setParticipants(await res.json());
    } catch {
      setMessage("Gagal memuat data peserta");
    } finally {
      setLoading(false);
    }
  };

  const sendCertificateWa = async (registrationId: string) => {
    setSendingId(registrationId);
    setMessage("");
    try {
      const res = await fetch("/api/certificates/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registrationId }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(data.message);
        loadParticipants(selectedSeminarId);
      } else {
        setMessage(`❌ ${data.error || "Gagal mengirim sertifikat"}`);
      }
    } catch {
      setMessage("❌ Gagal terhubung ke server");
    } finally {
      setSendingId(null);
    }
  };

  const sendAllCertificates = async () => {
    const presentParticipants = participants.filter(
      (p) => p.isPresent && p.phoneNumber && !p.certificateSent,
    );
    if (presentParticipants.length === 0) {
      setMessage(
        "Tidak ada peserta hadir dengan nomor WA yang belum mendapat sertifikat.",
      );
      return;
    }

    if (
      !confirm(
        `Kirim sertifikat ke ${presentParticipants.length} peserta via WhatsApp?`,
      )
    )
      return;

    setSendingAll(true);
    let sent = 0;
    let failed = 0;
    for (const p of presentParticipants) {
      try {
        const res = await fetch("/api/certificates/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ registrationId: p.id }),
        });
        if (res.ok) sent++;
        else failed++;
      } catch {
        failed++;
      }
    }
    setSendingAll(false);
    setMessage(`${sent} sertifikat terkirim, ${failed} gagal.`);
    loadParticipants(selectedSeminarId);
  };

  // Filter participants by search query
  const filteredParticipants = participants.filter((p) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.fullName?.toLowerCase().includes(q) ||
      p.phoneNumber?.toLowerCase().includes(q) ||
      p.email?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Manajemen Sertifikat
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Kirim sertifikat peserta seminar via WhatsApp
        </p>
      </div>

      {message && (
        <div
          className={`mb-6 px-5 py-4 rounded-xl text-sm ${
            message.startsWith("❌")
              ? "bg-red-50 border border-red-200 text-red-700"
              : "bg-green-50 border border-green-200 text-green-700"
          }`}
        >
          {message}
        </div>
      )}

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
              {s.title} — {s.date}
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
      ) : (
        <>
          {/* Ringkasan */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-2xl p-5 shadow-lg shadow-slate-200/50">
              <p className="text-3xl font-bold text-blue-700">
                {participants.length}
              </p>
              <p className="text-sm text-slate-500">Total Peserta</p>
            </div>
            <div className="bg-white rounded-2xl p-5 shadow-lg shadow-slate-200/50">
              <p className="text-3xl font-bold text-emerald-700">
                {
                  participants.filter((p) => p.isPresent && p.phoneNumber)
                    .length
                }
              </p>
              <p className="text-sm text-slate-500">Hadir & Punya WA</p>
            </div>
            <div className="bg-white rounded-2xl p-5 shadow-lg shadow-slate-200/50">
              <p className="text-3xl font-bold text-green-700">
                {participants.filter((p) => p.certificateSent).length}
              </p>
              <p className="text-sm text-slate-500">Sertifikat Terkirim</p>
            </div>
          </div>

          {participants.filter((p) => p.isPresent).length > 0 && (
            <button
              onClick={sendAllCertificates}
              disabled={sendingAll}
              className="mb-6 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all shadow-lg disabled:opacity-50 text-sm"
            >
              {sendingAll
                ? "Mengirim..."
                : `📤 Kirim Semua Sertifikat (${participants.filter((p) => p.isPresent && p.phoneNumber && !p.certificateSent).length} belum terkirim)`}
            </button>
          )}

          {participants.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              Belum ada peserta terdaftar
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 overflow-hidden">
              {/* Search Input */}
              <div className="p-4 border-b border-slate-200">
                <input
                  type="text"
                  placeholder="Cari peserta (nama, no. WA, email)..."
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
                      No. Sertifikat
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-700">
                      No. WA
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-700">
                      Email
                    </th>
                    <th className="text-center px-4 py-3 font-semibold text-slate-700">
                      Presensi
                    </th>
                    <th className="text-center px-4 py-3 font-semibold text-slate-700">
                      Status
                    </th>
                    <th className="text-center px-4 py-3 font-semibold text-slate-700">
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredParticipants.map((p: any) => {
                    const hasPhone = !!p.phoneNumber;
                    const isPresent = !!p.isPresent;
                    const isSent = !!p.certificateSent;

                    return (
                      <tr
                        key={p.id}
                        className="border-b border-slate-100 hover:bg-slate-50"
                      >
                        <td className="px-4 py-3 font-medium">{p.fullName}</td>
                        <td className="px-4 py-3">
                          {p.certificateCode ? (
                            <span className="font-mono text-xs text-blue-700 bg-blue-50 px-2 py-1 rounded-lg">
                              {p.certificateCode}
                            </span>
                          ) : (
                            <span className="text-slate-300 text-xs">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {p.phoneNumber || (
                            <span className="text-red-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {p.email || (
                            <span className="text-red-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                              isPresent
                                ? "bg-green-100 text-green-700"
                                : "bg-slate-100 text-slate-400"
                            }`}
                          >
                            {isPresent ? "Hadir" : "Belum"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                              isSent
                                ? "bg-green-100 text-green-700"
                                : "bg-slate-100 text-slate-400"
                            }`}
                          >
                            {isSent
                              ? "✓ Terkirim"
                              : isPresent && hasPhone
                                ? "Siap Kirim"
                                : "-"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            {isPresent && (
                              <>
                                {hasPhone && (
                                  <button
                                    onClick={() => sendCertificateWa(p.id)}
                                    disabled={sendingId === p.id}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-40 ${
                                      isSent
                                        ? "bg-amber-100 text-amber-700 hover:bg-amber-200"
                                        : "bg-blue-100 text-blue-700 hover:bg-blue-200"
                                    }`}
                                  >
                                    {sendingId === p.id
                                      ? "Mengirim..."
                                      : isSent
                                        ? "📤 Kirim Ulang"
                                        : "📤 Kirim"}
                                  </button>
                                )}
                                <button
                                  onClick={() =>
                                    window.open(
                                      `/api/certificates/generate?registrationId=${p.id}&seminarId=${selectedSeminarId}&print=true`,
                                      "_blank",
                                    )
                                  }
                                  className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
                                >
                                  🖨️ Cetak
                                </button>
                              </>
                            )}
                            {!isPresent && (
                              <span className="text-xs text-slate-400">-</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
