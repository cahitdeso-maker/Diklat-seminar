"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Seminar {
  id: string;
  title: string;
  description: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  maxParticipants: number;
  useQr: boolean;
  useFace: boolean;
  useManual: boolean;
  isActive: boolean;
  isCompleted: boolean;
  isDeleted: boolean;
  createdAt: string;
}

interface Speaker {
  id: string;
  seminarId: string;
  name: string;
  topic: string | null;
  displayOrder: number;
}

// Map to cache speakers per seminar for view mode
const speakersCache = new Map<string, Speaker[]>();
let cacheVersion = 0;

const emptyForm = {
  title: "",
  description: "",
  date: "",
  startTime: "",
  endTime: "",
  location: "",
  maxParticipants: "0",
  useQr: true,
  useFace: true,
  useManual: true,
  isActive: true,
};

export default function AdminSeminars() {
  const [seminars, setSeminars] = useState<Seminar[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"active" | "history">("active");
  const [searchQuery, setSearchQuery] = useState("");
  const [, setTick] = useState(0); // just to force re-render

  // Multi-speaker state
  const [speakersList, setSpeakersList] = useState<Speaker[]>([]);
  const [newSpeakerName, setNewSpeakerName] = useState("");
  const [newSpeakerTopic, setNewSpeakerTopic] = useState("");
  const [, forceUpdate] = useState(0);
  // Track speakers that were deleted from DB during editing (before save)
  const [deletedSpeakerIds, setDeletedSpeakerIds] = useState<string[]>([]);
  
  // Presensi toggle state per seminar
  const [presensiStatus, setPresensiStatus] = useState<Record<string, boolean>>({});
  const [presensiLoading, setPresensiLoading] = useState<Record<string, boolean>>({});
  const [presensiMsg, setPresensiMsg] = useState<Record<string, string>>({});

  const loadPresensiStatus = async (seminarId: string) => {
    try {
      const res = await fetch(`/api/seminars/${seminarId}/presensi-status`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setPresensiStatus(prev => ({ ...prev, [seminarId]: data.open === true }));
      }
    } catch (e) {
      console.error("Failed to load presensi status", e);
    }
  };

  const togglePresensi = async (seminarId: string) => {
    setPresensiLoading(prev => ({ ...prev, [seminarId]: true }));
    setPresensiMsg(prev => ({ ...prev, [seminarId]: "" }));
    try {
      const next = !presensiStatus[seminarId];
      const res = await fetch(`/api/seminars/${seminarId}/presensi-status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ open: next }),
      });
      const data = await res.json();
      if (res.ok) {
        setPresensiStatus(prev => ({ ...prev, [seminarId]: next }));
        setPresensiMsg(prev => ({ ...prev, [seminarId]: data.message || (next ? "Presensi dibuka" : "Presensi ditutup") }));
      } else {
        setPresensiMsg(prev => ({ ...prev, [seminarId]: data.error || "Gagal mengubah status presensi" }));
      }
    } catch (e) {
      setPresensiMsg(prev => ({ ...prev, [seminarId]: "Gagal mengubah status presensi" }));
    } finally {
      setPresensiLoading(prev => ({ ...prev, [seminarId]: false }));
    }
  };

  const hasEnded = (sem: Seminar): boolean => {
    if (!sem.date || !sem.endTime) {
      return false;
    }
    const seminarEnd = new Date(`${sem.date}T${sem.endTime}:00`);
    const now = new Date();
    return seminarEnd < now;
  };

  useEffect(() => {
    loadSeminars();
    // Force re-render every 30 seconds so completed status refreshes
    const interval = setInterval(() => setTick((n) => n + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  // Filter seminars by status — using isCompleted from database (set server-side via API) and end time
  const activeSeminars = seminars.filter(
    (sem) => !sem.isDeleted && !sem.isCompleted && !hasEnded(sem),
  );
  const historySeminars = seminars.filter(
    (sem) => sem.isDeleted || sem.isCompleted || hasEnded(sem),
  );

  // Load presensi status for all active seminars
  useEffect(() => {
    activeSeminars.forEach((sem) => {
      if (!sem.isCompleted && !hasEnded(sem) && !sem.isDeleted) {
        loadPresensiStatus(sem.id);
      }
    });
  }, [activeSeminars]);

  const displayedSeminars =
    activeTab === "active" ? activeSeminars : historySeminars;

  // Filter by search query
 
  const filteredSeminars = displayedSeminars.filter((sem) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      sem.title.toLowerCase().includes(q) ||
      sem.location?.toLowerCase().includes(q) ||
      sem.description?.toLowerCase().includes(q)
    );
  });

  const loadSeminars = async () => {
    try {
      const res = await fetch("/api/seminars?active=false");
      if (res.ok) {
        const data = await res.json();
        setSeminars(data);
        // Load speakers for all seminars in view mode
        data.forEach((sem: Seminar) => loadSpeakersToCache(sem.id));
      }
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const loadSpeakersToCache = async (seminarId: string) => {
    try {
      const res = await fetch(`/api/speakers?seminarId=${seminarId}`);
      if (res.ok) {
        const data = await res.json();
        speakersCache.set(seminarId, data);
        // Force re-render using separate counter to not interfere with edit form's speakersList
        forceUpdate((n) => n + 1);
      }
    } catch {}
  };

  const loadSpeakers = async (seminarId: string) => {
    console.log("🔍 loadSpeakers dipanggil dengan seminarId:", seminarId);
    try {
      const res = await fetch(`/api/speakers?seminarId=${seminarId}`);
      console.log(
        "🔍 loadSpeakers response status:",
        res.status,
        res.statusText,
      );
      if (res.ok) {
        const data = await res.json();
        console.log("🔍 loadSpeakers data diterima:", JSON.stringify(data));
        console.log("🔍 loadSpeakers jumlah data:", data.length);
        setSpeakersList(data);
      } else {
        const errorText = await res.text();
        console.error("🔍 loadSpeakers GAGAL:", res.status, errorText);
        setSpeakersList([]);
      }
    } catch (err) {
      console.error("🔍 loadSpeakers error:", err);
      setSpeakersList([]);
    }
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setError("");
    setSpeakersList([]);
    setNewSpeakerName("");
    setNewSpeakerTopic("");
    setDeletedSpeakerIds([]);
  };

  const openCreateForm = () => {
    resetForm();
    setShowForm(true);
  };

  const openEditForm = (sem: Seminar) => {
    // Prevent editing seminars that have ended
    if (hasEnded(sem)) {
      setError("Seminar yang sudah selesai tidak dapat diedit");
      return;
    }
    setForm({
      title: sem.title,
      description: sem.description || "",
      date: sem.date,
      startTime: sem.startTime || "",
      endTime: sem.endTime || "",
      location: sem.location || "",
      maxParticipants: String(sem.maxParticipants || 0),
      useQr: sem.useQr,
      useFace: sem.useFace,
      useManual: sem.useManual || false,
      isActive: sem.isActive,
    });
    setEditingId(sem.id);
    setShowForm(false);
    setError("");
    setNewSpeakerName("");
    setNewSpeakerTopic("");
    setDeletedSpeakerIds([]);
    loadSpeakers(sem.id);
  };

  const addSpeakerLocal = () => {
    if (!newSpeakerName.trim()) return;
    const tempSpeaker: Speaker = {
      id: "speaker-" + Date.now() + Math.random().toString(36).substr(2, 4),
      seminarId: editingId || "",
      name: newSpeakerName.trim(),
      topic: newSpeakerTopic.trim() || null,
      displayOrder: speakersList.length + 1,
    };
    setSpeakersList((prev) => [...prev, tempSpeaker]);
    setNewSpeakerName("");
    setNewSpeakerTopic("");
  };

  const deleteSpeakerLocally = (speakerId: string) => {
    // Remove from speakersList
    setSpeakersList((prev) => prev.filter((s) => s.id !== speakerId));
    // If it's a real speaker from DB (not local), track it for deletion on save
    if (!speakerId.startsWith("speaker-")) {
      setDeletedSpeakerIds((prev) => [...prev, speakerId]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      const isEdit = editingId !== null;
      let seminarId = editingId;

      if (isEdit) {
        const res = await fetch(`/api/seminars?id=${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Gagal menyimpan seminar");
          return;
        }
      } else {
        const res = await fetch("/api/seminars", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Gagal menyimpan seminar");
          return;
        }
        seminarId = data.id;
      }

      console.log(
        "📝 handleSubmit - editingId:",
        editingId,
        "seminarId:",
        seminarId,
      );
      console.log(
        "📝 handleSubmit - speakersList panjang:",
        speakersList.length,
      );
      console.log("📝 handleSubmit - deletedSpeakerIds:", deletedSpeakerIds);

      if (seminarId) {
        // 1) Delete speakers that were removed in edit mode
        if (deletedSpeakerIds.length > 0) {
          console.log("📝 Akan menghapus speaker IDs:", deletedSpeakerIds);
          for (const spId of deletedSpeakerIds) {
            const delRes = await fetch(`/api/speakers?id=${spId}`, {
              method: "DELETE",
            });
            if (!delRes.ok) {
              const err = await delRes.text();
              console.error("📝 GAGAL HAPUS speaker", spId, err);
            } else {
              console.log("📝 Berhasil hapus speaker:", spId);
            }
          }
        }

        // 2) Update speakers that already exist in DB but might have changed
        const existingSpeakers = speakersList.filter(
          (s) => !s.id.startsWith("speaker-"),
        );
        if (existingSpeakers.length > 0) {
          console.log(
            "📝 Akan update existing speakers:",
            existingSpeakers.length,
          );
          for (const sp of existingSpeakers) {
            const patchRes = await fetch(`/api/speakers?id=${sp.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                name: sp.name,
                topic: sp.topic,
                displayOrder: sp.displayOrder,
              }),
            });
            if (!patchRes.ok) {
              const err = await patchRes.text();
              console.error("📝 GAGAL UPDATE speaker", sp.id, sp.name, err);
            } else {
              console.log("📝 Berhasil update speaker:", sp.id, sp.name);
            }
          }
        }

        // 3) Insert new local speakers
        const localSpeakers = speakersList.filter((s) =>
          s.id.startsWith("speaker-"),
        );
        if (localSpeakers.length > 0) {
          console.log(
            "📝 Akan INSERT speakers baru:",
            localSpeakers.length,
            "items",
          );
          for (const sp of localSpeakers) {
            console.log(
              "📝 INSERT speaker:",
              sp.name,
              "untuk seminarId:",
              seminarId,
            );
            const postRes = await fetch("/api/speakers", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                seminarId,
                name: sp.name,
                topic: sp.topic,
              }),
            });
            if (!postRes.ok) {
              const err = await postRes.text();
              console.error(
                "📝 GAGAL INSERT speaker",
                sp.name,
                "status:",
                postRes.status,
                err,
              );
            } else {
              const result = await postRes.json();
              console.log(
                "📝 Berhasil INSERT speaker:",
                sp.name,
                "response:",
                JSON.stringify(result),
              );
            }
          }
        }
      }

      if (!isEdit) {
        // Create mode: close form, switch to active tab, reload, scroll to list
        setShowForm(false);
        setEditingId(null);
        resetForm();
        setActiveTab("active");
        await loadSeminars();
        // Scroll to the seminar list area
        setTimeout(() => {
          const listEl = document.getElementById("seminar-list");
          if (listEl) listEl.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 100);
        // Show success notification
        setError("✓ Seminar berhasil dibuat");
        setTimeout(() => setError(""), 3000);
      } else {
        // Edit mode: keep existing behavior
        setEditingId(null);
        resetForm();
        loadSeminars();
      }
    } catch {
      setError("Gagal menyimpan");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus seminar ini?")) return;
    await fetch(`/api/seminars?id=${id}`, { method: "DELETE" });
    loadSeminars();
  };

  const handleRestore = async (id: string) => {
    await fetch(`/api/seminars?id=${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isDeleted: false }),
    });
    loadSeminars();
  };

  const cancelEdit = () => {
    setEditingId(null);
    resetForm();
  };

  const getSpeakersText = (seminarId: string): string => {
    const cached = speakersCache.get(seminarId);
    if (cached && cached.length > 0) {
      return cached
        .map((s) => `${s.name}${s.topic ? ` (${s.topic})` : ""}`)
        .join(", ");
    }
    return "";
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Kelola Seminar</h1>
          <p className="text-sm text-gray-500 mt-1">
            Tambah, edit & atur seminar/pelatihan
          </p>
        </div>
        <button
          onClick={() => {
            if (showForm) {
              resetForm();
              setShowForm(false);
            } else if (editingId) {
              cancelEdit();
              openCreateForm();
            } else {
              openCreateForm();
            }
          }}
          className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg shadow-blue-200/50 text-sm"
        >
          {showForm ? "Batal" : "+ Seminar Baru"}
        </button>
      </div>

      {error && (
        <div className={`p-3 rounded-xl text-sm mb-4 ${
          error.startsWith("✓") 
            ? "bg-green-50 text-green-700 border border-green-200" 
            : "bg-red-50 text-red-600"
        }`}>
          {error}
        </div>
      )}

      {!showForm && (
        <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-xl w-fit">
          <button
            onClick={() => setActiveTab("active")}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
              activeTab === "active"
                ? "bg-white text-slate-800 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            📋 Seminar Aktif ({activeSeminars.length})
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
              activeTab === "history"
                ? "bg-white text-slate-800 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            🗂 Riwayat ({historySeminars.length})
          </button>
        </div>
      )}

      {/* Form create di atas */}
      {showForm && (
        <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 p-6 mb-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4">
            Buat Seminar Baru
          </h3>
          <form onSubmit={handleSubmit} className="grid md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Judul *
              </label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm focus:border-blue-400 outline-none"
                required
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Deskripsi
              </label>
              <textarea
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm focus:border-blue-400 outline-none resize-none"
                rows={3}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tanggal *
              </label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm focus:border-blue-400 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Mulai
              </label>
              <input
                type="time"
                value={form.startTime}
                onChange={(e) =>
                  setForm({ ...form, startTime: e.target.value })
                }
                className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm focus:border-blue-400 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Selesai
              </label>
              <input
                type="time"
                value={form.endTime}
                onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm focus:border-blue-400 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Lokasi
              </label>
              <input
                type="text"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm focus:border-blue-400 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Kuota Peserta (0 = unlimited)
              </label>
              <input
                type="number"
                value={form.maxParticipants}
                onChange={(e) =>
                  setForm({ ...form, maxParticipants: e.target.value })
                }
                className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm focus:border-blue-400 outline-none"
              />
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.useQr}
                  onChange={(e) =>
                    setForm({ ...form, useQr: e.target.checked })
                  }
                />
                QR Code
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.useFace}
                  onChange={(e) =>
                    setForm({ ...form, useFace: e.target.checked })
                  }
                />
                Face ID
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.useManual}
                  onChange={(e) =>
                    setForm({ ...form, useManual: e.target.checked })
                  }
                />
                Daftar Hadir
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) =>
                    setForm({ ...form, isActive: e.target.checked })
                  }
                />
                Aktif
              </label>
            </div>

            {/* Multi-Pemateri di form create */}
            <div className="md:col-span-2 border-t border-slate-200 pt-4 mt-2">
              <h4 className="font-semibold text-slate-700 text-sm mb-3">
                👤 Daftar Pemateri
              </h4>

              {speakersList.length > 0 && (
                <div className="space-y-2 mb-3">
                  {speakersList.map((sp) => (
                    <div
                      key={sp.id}
                      className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-2.5"
                    >
                      <div>
                        <span className="font-medium text-slate-700 text-sm">
                          {sp.name}
                        </span>
                        {sp.topic && (
                          <span className="text-slate-400 text-xs ml-2">
                            — {sp.topic}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => deleteSpeakerLocally(sp.id)}
                        className="text-red-400 hover:text-red-600 text-xs"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <input
                  type="text"
                  placeholder="Nama pemateri"
                  value={newSpeakerName}
                  onChange={(e) => setNewSpeakerName(e.target.value)}
                  className="flex-1 min-w-[180px] px-3 py-2 border border-slate-300 rounded-xl text-sm focus:border-blue-400 outline-none"
                />
                <input
                  type="text"
                  placeholder="Topik (opsional)"
                  value={newSpeakerTopic}
                  onChange={(e) => setNewSpeakerTopic(e.target.value)}
                  className="flex-1 min-w-[150px] px-3 py-2 border border-slate-300 rounded-xl text-sm focus:border-blue-400 outline-none"
                />
                <button
                  type="button"
                  onClick={addSpeakerLocal}
                  disabled={!newSpeakerName.trim()}
                  className="px-4 py-2 bg-indigo-50 text-indigo-600 font-semibold rounded-xl hover:bg-indigo-100 transition-all text-sm disabled:opacity-40"
                >
                  + Tambah
                </button>
              </div>
              <p className="text-xs text-slate-400 mt-1.5">
                Tambahkan satu atau lebih pemateri untuk seminar ini
              </p>
            </div>

            <div className="md:col-span-2">
              <button
                type="submit"
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg shadow-blue-200/50"
              >
                Simpan Seminar
              </button>
            </div>
          </form>
        </div>
      )}

      {!showForm && (loading ? (
        <div className="text-center py-12">
          <div className="animate-spin w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
        </div>
      ) : filteredSeminars.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          {searchQuery
            ? `Tidak ada seminar yang cocok dengan "${searchQuery}"`
            : activeTab === "active"
            ? "Belum ada seminar aktif"
            : "Belum ada riwayat seminar"}
        </div>
      ) : (
        <div id="seminar-list" className="space-y-3">
          {/* Search Input */}
          <div className="mb-4">
            <input
              type="text"
              placeholder="Cari seminar (judul, lokasi, deskripsi)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full md:w-96 px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
            />
          </div>
          {filteredSeminars
            .filter((sem) => (editingId ? sem.id === editingId : true))
            .map((sem) => {
              const isEditing = editingId === sem.id;
              const speakersText = getSpeakersText(sem.id);
              return (
                <div
                  key={sem.id}
                  className={`bg-white rounded-2xl shadow-xl shadow-slate-200/50 overflow-hidden hover:shadow-2xl transition-all ${
                    isEditing ? "ring-2 ring-indigo-300" : ""
                  }`}
                >
                  {isEditing ? (
                    // Mode EDIT — form inline di dalam card
                    <div className="p-5">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-indigo-700">
                          Edit Seminar
                        </h3>
                        <button
                          onClick={cancelEdit}
                          className="text-xs text-slate-400 hover:text-slate-600"
                        >
                          ✕ Tutup
                        </button>
                      </div>
                      <form
                        onSubmit={handleSubmit}
                        className="grid md:grid-cols-2 gap-3"
                      >
                        <div className="md:col-span-2">
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Judul *
                          </label>
                          <input
                            type="text"
                            value={form.title}
                            onChange={(e) =>
                              setForm({ ...form, title: e.target.value })
                            }
                            className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:border-indigo-400 outline-none"
                            required
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Deskripsi
                          </label>
                          <textarea
                            value={form.description}
                            onChange={(e) =>
                              setForm({ ...form, description: e.target.value })
                            }
                            className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:border-indigo-400 outline-none resize-none"
                            rows={2}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Tanggal *
                          </label>
                          <input
                            type="date"
                            value={form.date}
                            onChange={(e) =>
                              setForm({ ...form, date: e.target.value })
                            }
                            className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:border-indigo-400 outline-none"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Mulai
                          </label>
                          <input
                            type="time"
                            value={form.startTime}
                            onChange={(e) =>
                              setForm({ ...form, startTime: e.target.value })
                            }
                            className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:border-indigo-400 outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Selesai
                          </label>
                          <input
                            type="time"
                            value={form.endTime}
                            onChange={(e) =>
                              setForm({ ...form, endTime: e.target.value })
                            }
                            className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:border-indigo-400 outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Lokasi
                          </label>
                          <input
                            type="text"
                            value={form.location}
                            onChange={(e) =>
                              setForm({ ...form, location: e.target.value })
                            }
                            className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:border-indigo-400 outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Kuota (0 = unlimited)
                          </label>
                          <input
                            type="number"
                            value={form.maxParticipants}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                maxParticipants: e.target.value,
                              })
                            }
                            className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:border-indigo-400 outline-none"
                          />
                        </div>
                        <div className="md:col-span-2 flex items-center gap-4">
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={form.useQr}
                              onChange={(e) =>
                                setForm({ ...form, useQr: e.target.checked })
                              }
                            />
                            QR Code
                          </label>
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={form.useFace}
                              onChange={(e) =>
                                setForm({ ...form, useFace: e.target.checked })
                              }
                            />
                            Face ID
                          </label>
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={form.useManual}
                              onChange={(e) =>
                                setForm({ ...form, useManual: e.target.checked })
                              }
                            />
                            Daftar Hadir
                          </label>
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={form.isActive}
                              onChange={(e) =>
                                setForm({ ...form, isActive: e.target.checked })
                              }
                            />
                            Aktif
                          </label>
                        </div>

                        {/* Multi-Pemateri Section (Edit) */}
                        <div className="md:col-span-2 border-t border-slate-200 pt-4 mt-2">
                          <h4 className="font-semibold text-slate-700 text-sm mb-3">
                            👤 Daftar Pemateri
                          </h4>

                          {speakersList.length > 0 && (
                            <div className="space-y-2 mb-3">
                              {speakersList.map((sp) => (
                                <div
                                  key={sp.id}
                                  className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-2.5"
                                >
                                  <div>
                                    <span className="font-medium text-slate-700 text-sm">
                                      {sp.name}
                                    </span>
                                    {sp.topic && (
                                      <span className="text-slate-400 text-xs ml-2">
                                        — {sp.topic}
                                      </span>
                                    )}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => deleteSpeakerLocally(sp.id)}
                                    className="text-red-400 hover:text-red-600 text-xs"
                                  >
                                    ✕
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}

                          <div className="flex flex-wrap gap-2">
                            <input
                              type="text"
                              placeholder="Nama pemateri"
                              value={newSpeakerName}
                              onChange={(e) =>
                                setNewSpeakerName(e.target.value)
                              }
                              className="flex-1 min-w-[180px] px-3 py-2 border border-slate-300 rounded-xl text-sm focus:border-indigo-400 outline-none"
                            />
                            <input
                              type="text"
                              placeholder="Topik (opsional)"
                              value={newSpeakerTopic}
                              onChange={(e) =>
                                setNewSpeakerTopic(e.target.value)
                              }
                              className="flex-1 min-w-[150px] px-3 py-2 border border-slate-300 rounded-xl text-sm focus:border-indigo-400 outline-none"
                            />
                            <button
                              type="button"
                              onClick={addSpeakerLocal}
                              disabled={!newSpeakerName.trim()}
                              className="px-4 py-2 bg-indigo-50 text-indigo-600 font-semibold rounded-xl hover:bg-indigo-100 transition-all text-sm disabled:opacity-40"
                            >
                              + Tambah
                            </button>
                          </div>
                          <p className="text-xs text-slate-400 mt-1.5">
                            Tambahkan satu atau lebih pemateri untuk seminar ini
                          </p>
                        </div>

                        <div className="md:col-span-2 flex gap-3 pt-2">
                          <button
                            type="submit"
                            className="flex-1 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white font-semibold rounded-xl hover:from-indigo-700 hover:to-indigo-800 transition-all shadow-md text-sm"
                          >
                            💾 Simpan Perubahan
                          </button>
                          <button
                            type="button"
                            onClick={cancelEdit}
                            className="px-5 py-2.5 bg-slate-100 text-slate-600 font-semibold rounded-xl hover:bg-slate-200 transition-all text-sm"
                          >
                            Batal
                          </button>
                        </div>
                      </form>
                    </div>
                  ) : viewingId === sem.id ? (
                    // Mode LIHAT — tampilan detail read-only
                    <div className="p-5">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-slate-800">Detail Seminar</h3>
                        <button
                          onClick={() => setViewingId(null)}
                          className="text-xs text-slate-400 hover:text-slate-600"
                        >
                          ✕ Tutup
                        </button>
                      </div>
                      <div className="space-y-3 text-sm">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-slate-800">{sem.title}</h4>
                        {sem.isDeleted && (
                          <span className="px-2 py-0.5 bg-red-100 text-red-700 text-[10px] font-semibold rounded">
                            Terhapus
                          </span>
                        )}
                        {!sem.isDeleted && sem.isCompleted && (
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-semibold rounded">
                            ✅ Selesai
                          </span>
                        )}
                        {!sem.isDeleted && !sem.isCompleted && hasEnded(sem) && (
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-semibold rounded">
                            ✅ Selesai
                          </span>
                        )}
                        {!sem.isActive &&
                          !sem.isDeleted &&
                          !sem.isCompleted &&
                          !hasEnded(sem) && (
                            <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-[10px] font-semibold rounded">
                              Nonaktif
                            </span>
                          )}
                      </div>
                        <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                          <div><span className="font-medium text-slate-700">Tanggal:</span> {sem.date}</div>
                          <div><span className="font-medium text-slate-700">Mulai:</span> {sem.startTime || "-"}</div>
                          <div><span className="font-medium text-slate-700">Selesai:</span> {sem.endTime || "-"}</div>
                          <div><span className="font-medium text-slate-700">Lokasi:</span> {sem.location || "-"}</div>
                          <div><span className="font-medium text-slate-700">Kuota:</span> {sem.maxParticipants === 0 ? "Unlimited" : sem.maxParticipants}</div>
                          <div><span className="font-medium text-slate-700">QR Code:</span> {sem.useQr ? "Ya" : "Tidak"}</div>
                          <div><span className="font-medium text-slate-700">Face ID:</span> {sem.useFace ? "Ya" : "Tidak"}</div>
                          <div><span className="font-medium text-slate-700">Daftar Hadir:</span> {sem.useManual ? "Ya" : "Tidak"}</div>
                          <div><span className="font-medium text-slate-700">Status:</span> 
                            {!sem.isActive && !sem.isDeleted && !sem.isCompleted && !hasEnded(sem) ? "Nonaktif" : 
                              sem.isDeleted ? "Terhapus" : 
                                sem.isCompleted || hasEnded(sem) ? "Selesai" : "Aktif"}
                          </div>
                        </div>
                        {sem.description && (
                          <div>
                            <span className="font-medium text-slate-700">Deskripsi:</span>
                            <p className="text-slate-600 mt-1 whitespace-pre-wrap">{sem.description}</p>
                          </div>
                        )}
                        <div>
                          <span className="font-medium text-slate-700">Pemateri:</span>
                          {speakersText ? (
                            <ul className="list-disc list-inside text-slate-600 mt-1 space-y-0.5">
                              {speakersCache.get(sem.id)?.map((sp) => (
                                <li key={sp.id}>{sp.name}{sp.topic && ` (${sp.topic})`}</li>
                              ))}
                            </ul>
                          ) : (
                            <span className="text-slate-400 ml-2">-</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-200">
                        <Link
                          href={`/admin/participants?seminarId=${sem.id}`}
                          className="px-3 py-1.5 bg-blue-50 text-blue-600 text-xs font-semibold rounded-xl hover:bg-blue-100 transition-all"
                        >
                          👥 Lihat Peserta
                        </Link>
                        {sem.isDeleted && (
                          <button
                            onClick={() => handleRestore(sem.id)}
                            className="px-3 py-1.5 bg-emerald-50 text-emerald-600 text-xs font-semibold rounded-xl hover:bg-emerald-100 transition-all"
                          >
                            ↩️ Pulihkan
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <>
                    {/* Mode VIEW — tampilan card biasa */}
                    <div className="p-5 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-slate-800">
                            {sem.title}
                          </h3>
                          {sem.isDeleted && (
                            <span className="px-2 py-0.5 bg-red-100 text-red-700 text-[10px] font-semibold rounded">
                              Terhapus
                            </span>
                          )}
                          {!sem.isDeleted && sem.isCompleted && (
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-semibold rounded">
                              ✅ Selesai
                            </span>
                          )}
                          {!sem.isDeleted && !sem.isCompleted && hasEnded(sem) && (
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-semibold rounded">
                              ✅ Selesai
                            </span>
                          )}
                          {!sem.isActive &&
                            !sem.isDeleted &&
                            !sem.isCompleted &&
                            !hasEnded(sem) && (
                              <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-[10px] font-semibold rounded">
                                Nonaktif
                              </span>
                            )}
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          {sem.date} {sem.startTime && `| ${sem.startTime}`}{" "}
                          {sem.location && `| ${sem.location}`}
                        </p>
                        {speakersText && (
                          <p className="text-xs text-indigo-500 mt-0.5">
                            👤 {speakersText}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                      {sem.isDeleted ? (
                        <>
                          <button
                            onClick={() => handleRestore(sem.id)}
                            className="px-3 py-1.5 bg-emerald-50 text-emerald-600 text-xs font-semibold rounded-xl hover:bg-emerald-100 transition-all"
                          >
                            ↩️ Pulihkan
                          </button>
                          <Link
                            href={`/admin/participants?seminarId=${sem.id}`}
                            className="px-3 py-1.5 bg-blue-50 text-blue-600 text-xs font-semibold rounded-xl hover:bg-blue-100 transition-all"
                          >
                            👥 Peserta
                          </Link>
                        </>
                      ) : (
                        <>
                          {!sem.isCompleted && !hasEnded(sem) && (
                            <button
                              onClick={() => openEditForm(sem)}
                              className="px-3 py-1.5 bg-indigo-50 text-indigo-600 text-xs font-semibold rounded-xl hover:bg-indigo-100 transition-all"
                            >
                              ✏️ Edit
                            </button>
                          )}
                          <Link
                            href={`/admin/participants?seminarId=${sem.id}`}
                            className="px-3 py-1.5 bg-blue-50 text-blue-600 text-xs font-semibold rounded-xl hover:bg-blue-100 transition-all"
                          >
                            👥 Peserta
                          </Link>
                          {!sem.isCompleted && !hasEnded(sem) && (
                            <button
                              onClick={() => handleDelete(sem.id)}
                              className="px-3 py-1.5 bg-red-50 text-red-600 text-xs font-semibold rounded-xl hover:bg-red-100 transition-all"
                            >
                              🗑 Hapus
                            </button>
                          )}
                          {(sem.isCompleted || sem.isDeleted || hasEnded(sem)) && (
                            <button
                              onClick={() => setViewingId(sem.id)}
                              className="px-3 py-1.5 bg-slate-50 text-slate-600 text-xs font-semibold rounded-xl hover:bg-slate-100 transition-all"
                            >
                              👁️ Lihat
                            </button>
                          )}
                        </>
                      )}
                      </div>
                    </div>
                    {/* Presensi toggle for ongoing seminars */}
                    {!sem.isCompleted && !hasEnded(sem) && !sem.isDeleted && (
                      <div className="px-5 pb-4 pt-0">
                        <div className="flex items-center justify-between py-2 px-4 rounded-xl bg-slate-50">
                          <div className="flex items-center gap-2">
                            <div className={`w-2.5 h-2.5 rounded-full ${presensiStatus[sem.id] ? "bg-green-500 animate-pulse" : "bg-red-500"}`}></div>
                            <span className="text-xs font-medium text-slate-600">
                              Akses Presensi: <span className={presensiStatus[sem.id] ? "text-green-600" : "text-red-600"}>{presensiStatus[sem.id] ? "Terbuka" : "Tertutup"}</span>
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {presensiMsg[sem.id] && (
                              <span className={`text-[10px] ${
                                presensiMsg[sem.id].includes("DIBUKA") || presensiMsg[sem.id].includes("dibuka")
                                  ? "text-green-600"
                                  : presensiMsg[sem.id].includes("DITUTUP") || presensiMsg[sem.id].includes("ditutup")
                                  ? "text-red-600"
                                  : "text-amber-600"
                              }`}>
                                {presensiMsg[sem.id]}
                              </span>
                            )}
                            <button
                              onClick={() => togglePresensi(sem.id)}
                              disabled={presensiLoading[sem.id]}
                              className={`relative inline-flex h-6 w-10 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                                presensiStatus[sem.id]
                                  ? "bg-green-500 focus:ring-green-500"
                                  : "bg-slate-300 focus:ring-slate-500"
                              }`}
                            >
                              <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition-transform ${
                                  presensiStatus[sem.id] ? "translate-x-5" : "translate-x-0.5"
                                }`}
                              />
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                    {/* Feature badges */}
                    <div className="px-5 pb-4 pt-0">
                      <div className="flex items-center gap-2">
                        {sem.useFace && (
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-700">
                            Face Recognition
                          </span>
                        )}
                        {sem.useQr && (
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
                            QR Code
                          </span>
                        )}
                        {sem.useManual && (
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-emerald-100 text-emerald-700">
                            Daftar Hadir
                          </span>
                        )}
                      </div>
                    </div>
                    </>
                  )}
                </div>
              );
            })}
        </div>
      ))}
    </div>
  );
}