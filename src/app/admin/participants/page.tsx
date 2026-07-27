"use client";

import { useState, useEffect } from "react";
import ConfirmModal from "@/components/ConfirmModal";

export default function ParticipantsPage() {
  const [seminars, setSeminars] = useState<any[]>([]);
  const [selectedSeminarId, setSelectedSeminarId] = useState("");
  const [participants, setParticipants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Edit state
  const [editModal, setEditModal] = useState<{
    participant: any;
  } | null>(null);
  const [editForm, setEditForm] = useState({
    fullName: "",
    email: "",
    phoneNumber: "",
    institution: "",
    profession: "",
  });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState("");

  // Delete state
  const [deleteModal, setDeleteModal] = useState<{
    participant: any;
  } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Feedback toast
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const showToast = (type: "success" | "error", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

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

  const openEditModal = (participant: any) => {
    setEditModal({ participant });
    setEditForm({
      fullName: participant.fullName || "",
      email: participant.email || "",
      phoneNumber: participant.phoneNumber || "",
      institution: participant.institution || "",
      profession: participant.profession || "",
    });
    setEditError("");
  };

  const handleEditSubmit = async () => {
    if (!editModal) return;
    if (!editForm.fullName.trim()) {
      setEditError("Nama lengkap harus diisi");
      return;
    }

    setEditLoading(true);
    setEditError("");
    try {
      const res = await fetch(
        `/api/registrations?id=${editModal.participant.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fullName: editForm.fullName.trim(),
            email: editForm.email.trim() || null,
            phoneNumber: editForm.phoneNumber.trim() || null,
            institution: editForm.institution.trim() || null,
            profession: editForm.profession.trim() || null,
          }),
        },
      );

      const result = await res.json();
      if (!res.ok) {
        setEditError(result.error || "Gagal mengupdate data");
        return;
      }

      showToast("success", "Data peserta berhasil diperbarui");
      setEditModal(null);
      // Refresh data
      loadParticipants(selectedSeminarId);
    } catch {
      setEditError("Terjadi kesalahan, silakan coba lagi");
    } finally {
      setEditLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteModal) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(
        `/api/registrations?id=${deleteModal.participant.id}`,
        {
          method: "DELETE",
        },
      );

      const result = await res.json();
      if (!res.ok) {
        showToast("error", result.error || "Gagal menghapus peserta");
        return;
      }

      showToast("success", "Peserta berhasil dihapus");
      setDeleteModal(null);
      loadParticipants(selectedSeminarId);
    } catch {
      showToast("error", "Terjadi kesalahan, silakan coba lagi");
    } finally {
      setDeleteLoading(false);
    }
  };

  const filteredParticipants = participants.filter((p: any) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.fullName?.toLowerCase().includes(q) ||
      p.email?.toLowerCase().includes(q) ||
      p.institution?.toLowerCase().includes(q) ||
      p.profession?.toLowerCase().includes(q) ||
      p.certificateCode?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Daftar Peserta</h1>
        <p className="text-sm text-gray-500 mt-1">
          Data registrasi peserta seminar
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
          <div className="p-4 border-b border-slate-200">
            <input
              type="text"
              placeholder="Cari peserta (nama, email, institusi, profesi, no. sertifikat)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full md:w-96 px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 font-semibold text-slate-700">Nama</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700">No. Sertifikat</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700">Email</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700">No. WA</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700">Institusi</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700">Profesi</th>
                  <th className="text-center px-4 py-3 font-semibold text-slate-700">Presensi</th>
                  <th className="text-center px-4 py-3 font-semibold text-slate-700">Waktu</th>
                  <th className="text-center px-4 py-3 font-semibold text-slate-700">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredParticipants.map((p: any) => (
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
                    <td className="px-4 py-3 text-slate-500">{p.email || "-"}</td>
                    <td className="px-4 py-3 text-slate-500">{p.phoneNumber || "-"}</td>
                    <td className="px-4 py-3 text-slate-500">{p.institution || "-"}</td>
                    <td className="px-4 py-3 text-slate-500">{p.profession || "-"}</td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                          p.isPresent
                            ? "bg-green-100 text-green-700"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {p.isPresent ? "Hadir" : "Belum"}
                      </span>
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
                      <div className="inline-flex items-center gap-2">
                        <button
                          onClick={() => openEditModal(p)}
                          className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 transition-all"
                          title="Edit peserta"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setDeleteModal({ participant: p })}
                          className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-red-50 text-red-500 hover:bg-red-100 hover:text-red-600 transition-all"
                          title="Hapus peserta"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[998] animate-[slideUpIn_0.3s_ease-out]">
          <div
            className={`flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl text-sm font-medium ${
              toast.type === "success"
                ? "bg-emerald-600 text-white"
                : "bg-red-600 text-white"
            }`}
          >
            {toast.type === "success" ? (
              <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            ) : (
              <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
              </svg>
            )}
            <span>{toast.message}</span>
            <button
              onClick={() => setToast(null)}
              className="ml-2 hover:opacity-80 transition-opacity"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editModal && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={editLoading ? undefined : () => setEditModal(null)}
          />
          <div className="relative z-10 w-full max-w-md animate-[fadeScaleIn_0.2s_ease-out] rounded-2xl bg-white p-6 shadow-2xl">
            <button
              onClick={() => setEditModal(null)}
              disabled={editLoading}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-40"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="mb-4 mt-2">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-100">
                <svg className="h-7 w-7 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                </svg>
              </div>
            </div>

            <h3 className="text-lg font-bold text-slate-900 text-center mb-6">
              Edit Peserta
            </h3>

            {editError && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600">
                {editError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Nama Lengkap <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={editForm.fullName}
                  onChange={(e) =>
                    setEditForm({ ...editForm, fullName: e.target.value })
                  }
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                  placeholder="Nama lengkap"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) =>
                    setEditForm({ ...editForm, email: e.target.value })
                  }
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                  placeholder="contoh@email.com"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  No. WhatsApp
                </label>
                <input
                  type="text"
                  value={editForm.phoneNumber}
                  onChange={(e) =>
                    setEditForm({ ...editForm, phoneNumber: e.target.value })
                  }
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                  placeholder="081234567890"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Institusi
                </label>
                <input
                  type="text"
                  value={editForm.institution}
                  onChange={(e) =>
                    setEditForm({ ...editForm, institution: e.target.value })
                  }
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                  placeholder="Nama institusi"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Profesi
                </label>
                <input
                  type="text"
                  value={editForm.profession}
                  onChange={(e) =>
                    setEditForm({ ...editForm, profession: e.target.value })
                  }
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                  placeholder="Dokter, Perawat, dll."
                />
              </div>
            </div>

            <div className="mt-6 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setEditModal(null)}
                disabled={editLoading}
                className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-all hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleEditSubmit}
                disabled={editLoading}
                className="flex-1 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition-all focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 disabled:opacity-50"
              >
                {editLoading ? (
                  <span className="inline-flex items-center gap-2">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Menyimpan...
                  </span>
                ) : (
                  "Simpan Perubahan"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        open={!!deleteModal}
        onClose={() => setDeleteModal(null)}
        onConfirm={handleDelete}
        title="Hapus Peserta"
        message={`Apakah Anda yakin ingin menghapus peserta "${deleteModal?.participant?.fullName || ""}"? Data yang sudah dihapus tidak dapat dikembalikan.`}
        confirmLabel="Ya, Hapus"
        cancelLabel="Batal"
        confirmVariant="danger"
        loading={deleteLoading}
        icon={
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
            <svg className="h-7 w-7 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
            </svg>
          </div>
        }
      />

      {/* Global keyframe animations */}
      <style>{`
        @keyframes fadeScaleIn {
          from {
            opacity: 0;
            transform: scale(0.95) translateY(8px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        @keyframes slideUpIn {
          from {
            opacity: 0;
            transform: translateY(16px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
