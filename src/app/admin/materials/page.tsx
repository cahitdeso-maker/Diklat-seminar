"use client";

import { useState, useEffect, useRef } from "react";

interface Material {
  id: string;
  name: string;
  originalName: string;
  url: string;
  size: number;
  type: string;
  speakerName: string;
  uploadedAt: string;
}

interface Seminar {
  id: string;
  title: string;
  date: string;
}

interface Speaker {
  id: string;
  name: string;
  topic: string | null;
}

export default function MaterialsPage() {
  const [seminars, setSeminars] = useState<Seminar[]>([]);
  const [selectedSeminarId, setSelectedSeminarId] = useState("");
  const [materials, setMaterials] = useState<Material[]>([]);
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [selectedSpeakerNames, setSelectedSpeakerNames] = useState<string[]>(
    [],
  );
  const [editingMaterialId, setEditingMaterialId] = useState<string | null>(
    null,
  );
  const [editingSpeakerNames, setEditingSpeakerNames] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/seminars?active=false")
      .then((r) => r.ok && r.json())
      .then((d) => {
        setSeminars(d || []);
        setLoading(false);
      });
  }, []);

  const loadMaterials = async (seminarId: string) => {
    setMessage("");
    try {
      const res = await fetch(`/api/materials?seminarId=${seminarId}`);
      if (res.ok) setMaterials(await res.json());
    } catch {
      setMessage("Gagal memuat data materi");
    }
  };

  const loadSpeakers = async (seminarId: string) => {
    try {
      const res = await fetch(`/api/speakers?seminarId=${seminarId}`);
      if (res.ok) {
        const data: Speaker[] = await res.json();
        setSpeakers(data);
        // Auto-select all speakers as default
        if (data.length > 0) {
          setSelectedSpeakerNames(data.map((sp) => sp.name));
        }
        return data;
      } else {
        setSpeakers([]);
        return [];
      }
    } catch {
      setSpeakers([]);
      return [];
    }
  };

  const handleSelectSeminar = async (seminarId: string) => {
    setSelectedSeminarId(seminarId);
    setSelectedSpeakerNames([]);
    if (seminarId) {
      setMaterials([]);
      loadMaterials(seminarId);
      loadSpeakers(seminarId);
    }
  };

  const toggleSpeaker = (name: string) => {
    setSelectedSpeakerNames((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name],
    );
  };

  const toggleEditSpeaker = (name: string) => {
    setEditingSpeakerNames((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name],
    );
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileInputRef.current?.files?.length || !selectedSeminarId) return;

    setUploading(true);
    setMessage("");

    const formData = new FormData();
    formData.append("seminarId", selectedSeminarId);
    formData.append("file", fileInputRef.current.files[0]);
    formData.append("speakerName", selectedSpeakerNames.join(", "));

    try {
      const res = await fetch("/api/materials", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(`✅ ${data.message}`);
        if (fileInputRef.current) fileInputRef.current.value = "";
        loadMaterials(selectedSeminarId);
      } else {
        setMessage(`❌ ${data.error || "Gagal upload"}`);
      }
    } catch {
      setMessage("❌ Gagal terhubung ke server");
    } finally {
      setUploading(false);
    }
  };

  const handleEditSpeaker = (material: Material) => {
    setEditingMaterialId(material.id);
    setEditingSpeakerNames(
      material.speakerName
        ? material.speakerName.split(", ").filter(Boolean)
        : [],
    );
  };

  const handleSaveSpeaker = async () => {
    if (!editingMaterialId || editingSpeakerNames.length === 0) return;

    setMessage("");
    try {
      const res = await fetch(
        `/api/materials?seminarId=${selectedSeminarId}&materialId=${editingMaterialId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ speakerName: editingSpeakerNames.join(", ") }),
        },
      );
      const data = await res.json();
      if (res.ok) {
        setMessage(`✅ ${data.message}`);
        setEditingMaterialId(null);
        loadMaterials(selectedSeminarId);
      } else {
        setMessage(`❌ ${data.error || "Gagal update"}`);
      }
    } catch {
      setMessage("❌ Gagal terhubung ke server");
    }
  };

  const handleCancelEdit = () => {
    setEditingMaterialId(null);
    setEditingSpeakerNames([]);
  };

  // Filter materials by search query
  const filteredMaterials = materials.filter((m) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      m.originalName?.toLowerCase().includes(q) ||
      m.speakerName?.toLowerCase().includes(q) ||
      m.type?.toLowerCase().includes(q)
    );
  });

  const handleDelete = async (material: Material) => {
    if (!confirm(`Hapus materi "${material.originalName}"?`)) return;

    try {
      const res = await fetch(
        `/api/materials?seminarId=${selectedSeminarId}&materialId=${material.id}`,
        { method: "DELETE" },
      );
      const data = await res.json();
      if (res.ok) {
        setMessage(`✅ ${data.message}`);
        loadMaterials(selectedSeminarId);
      } else {
        setMessage(`❌ ${data.error || "Gagal hapus"}`);
      }
    } catch {
      setMessage("❌ Gagal terhubung ke server");
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString("id-ID", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  const getFileIcon = (type: string): string => {
    if (type.includes("pdf")) return "📄";
    if (type.includes("presentation") || type.includes("powerpoint"))
      return "📽️";
    if (type.includes("word") || type.includes("document")) return "📝";
    if (type.includes("excel") || type.includes("spreadsheet")) return "📊";
    if (type.includes("image")) return "🖼️";
    if (type.includes("text")) return "📃";
    return "📁";
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Materi Seminar</h1>
        <p className="text-sm text-gray-500 mt-1">
          Upload & kelola materi seminar (PDF, PPT, DOC, dll.)
        </p>
      </div>

      {message && (
        <div
          className={`mb-6 px-5 py-4 rounded-xl text-sm ${
            message.startsWith("✅")
              ? "bg-green-50 border border-green-200 text-green-700"
              : "bg-red-50 border border-red-200 text-red-700"
          }`}
        >
          {message}
        </div>
      )}

      {/* Pilih Seminar */}
      <div className="mb-6">
        <select
          value={selectedSeminarId}
          onChange={(e) => handleSelectSeminar(e.target.value)}
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

      {!selectedSeminarId ? (
        <div className="text-center py-12 text-slate-400">
          Pilih seminar untuk mengelola materi
        </div>
      ) : (
        <>
          {/* Form Upload */}
          <div className="bg-white rounded-2xl shadow-lg shadow-slate-200/50 p-5 mb-6">
            <h3 className="font-semibold text-slate-800 mb-3">
              📤 Upload Materi Baru
            </h3>
            <form onSubmit={handleUpload} className="space-y-3">
              <div className="flex flex-wrap items-start gap-3">
                <div className="w-56">
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                    👤 Pilih Pemateri (bisa lebih dari satu)
                  </label>
                  <div className="max-h-40 overflow-y-auto border border-slate-300 rounded-xl p-2 space-y-1">
                    {speakers.length === 0 && (
                      <p className="text-xs text-slate-400 text-center py-2">
                        Belum ada pemateri
                      </p>
                    )}
                    {speakers.map((sp) => (
                      <label
                        key={sp.id}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer text-sm transition-all ${
                          selectedSpeakerNames.includes(sp.name)
                            ? "bg-blue-50 text-blue-700 font-medium"
                            : "text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedSpeakerNames.includes(sp.name)}
                          onChange={() => toggleSpeaker(sp.name)}
                          className="accent-blue-600"
                        />
                        {sp.name}
                        {sp.topic && (
                          <span className="text-xs text-slate-400">
                            — {sp.topic}
                          </span>
                        )}
                      </label>
                    ))}
                  </div>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp,.txt"
                  className="flex-1 min-w-[200px] px-4 py-2.5 border border-slate-300 rounded-xl text-sm file:mr-3 file:py-1.5 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 outline-none"
                  required
                />
                <button
                  type="submit"
                  disabled={uploading || selectedSpeakerNames.length === 0}
                  className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md disabled:opacity-50 text-sm whitespace-nowrap"
                >
                  {uploading ? "Uploading..." : "Upload"}
                </button>
              </div>
              <p className="text-xs text-slate-400">
                Pilih satu atau lebih pemateri, lalu pilih file. Format: PDF,
                PPT, DOC, Excel, Gambar, TXT. Maks 50MB.
              </p>
            </form>
          </div>

          {/* Daftar Materi */}
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
            </div>
          ) : materials.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              Belum ada materi untuk seminar ini
            </div>
          ) : (
            <div className="space-y-2">
              {/* Search Input */}
              <div className="mb-4">
                <input
                  type="text"
                  placeholder="Cari materi (nama file, pemateri, tipe file)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full md:w-96 px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                />
              </div>
              {filteredMaterials.map((m) => (
                <div
                  key={m.id}
                  className="bg-white rounded-2xl shadow-lg shadow-slate-200/50 p-4 flex items-center justify-between hover:shadow-xl transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className="text-2xl">{getFileIcon(m.type)}</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-slate-800 text-sm truncate max-w-md">
                        {m.originalName}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {editingMaterialId === m.id ? (
                          <span className="inline-flex flex-wrap items-center gap-1.5">
                            👤
                            <span className="inline-flex flex-col border border-slate-300 rounded-lg p-1.5 bg-white">
                              {speakers.length === 0 && (
                                <span className="text-xs text-slate-400 px-1">
                                  Tidak ada pemateri
                                </span>
                              )}
                              {speakers.map((sp) => (
                                <label
                                  key={sp.id}
                                  className={`flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer text-xs transition-all ${
                                    editingSpeakerNames.includes(sp.name)
                                      ? "bg-blue-50 text-blue-700 font-medium"
                                      : "text-slate-600 hover:bg-slate-50"
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={editingSpeakerNames.includes(
                                      sp.name,
                                    )}
                                    onChange={() => toggleEditSpeaker(sp.name)}
                                    className="accent-blue-600"
                                  />
                                  {sp.name}
                                  {sp.topic && (
                                    <span className="text-[10px] text-slate-400">
                                      — {sp.topic}
                                    </span>
                                  )}
                                </label>
                              ))}
                            </span>
                            <button
                              onClick={handleSaveSpeaker}
                              disabled={editingSpeakerNames.length === 0}
                              className="px-2 py-1 bg-green-50 text-green-600 font-semibold rounded-lg hover:bg-green-100 transition-all text-[10px] disabled:opacity-40"
                            >
                              💾 Simpan
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              className="px-2 py-1 bg-slate-50 text-slate-500 font-semibold rounded-lg hover:bg-slate-100 transition-all text-[10px]"
                            >
                              ✕ Batal
                            </button>
                          </span>
                        ) : (
                          <>
                            👤{" "}
                            <span className="font-medium text-slate-500">
                              {m.speakerName}
                            </span>
                            {" • "}
                            {formatFileSize(m.size)} •{" "}
                            {formatDate(m.uploadedAt)}
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <a
                      href={m.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 bg-blue-50 text-blue-600 text-xs font-semibold rounded-xl hover:bg-blue-100 transition-all"
                    >
                      🔽 Unduh
                    </a>
                    <button
                      onClick={() => handleEditSpeaker(m)}
                      className="px-3 py-1.5 bg-amber-50 text-amber-600 text-xs font-semibold rounded-xl hover:bg-amber-100 transition-all"
                    >
                      ✏️ Edit Pemateri
                    </button>
                    <button
                      onClick={() => handleDelete(m)}
                      className="px-3 py-1.5 bg-red-50 text-red-600 text-xs font-semibold rounded-xl hover:bg-red-100 transition-all"
                    >
                      🗑 Hapus
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
