"use client";

import { useState, useEffect, useMemo } from "react";

interface Signature {
  id: string;
  name: string;
  position: string;
  nip: string | null;
  signatureImage: string | null;
  isActive: boolean;
}

export default function SignaturesPage() {
  const [signatures, setSignatures] = useState<Signature[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    position: "",
    nip: "",
    signatureImage: "",
    isActive: false,
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const loadData = async () => {
    try {
      const res = await fetch("/api/signatures");
      if (res.ok) setSignatures(await res.json());
    } catch {
      setMessage("Gagal memuat data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredSignatures = useMemo(() => {
    if (!searchQuery.trim()) return signatures;
    const query = searchQuery.toLowerCase();
    return signatures.filter(
      (s) =>
        s.name.toLowerCase().includes(query) ||
        s.position.toLowerCase().includes(query) ||
        (s.nip && s.nip.toLowerCase().includes(query))
    );
  }, [signatures, searchQuery]);

  const openAdd = () => {
    setEditingId(null);
    setForm({
      name: "",
      position: "",
      nip: "",
      signatureImage: "",
      isActive: false,
    });
    setShowModal(true);
  };

  const openEdit = (s: Signature) => {
    setEditingId(s.id);
    setForm({
      name: s.name,
      position: s.position,
      nip: s.nip || "",
      signatureImage: s.signatureImage || "",
      isActive: false,
    });
    setShowModal(true);
  };

  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok) {
        setForm({ ...form, signatureImage: data.url });
      } else {
        setMessage(`❌ ${data.error}`);
      }
    } catch {
      setMessage("❌ Gagal upload gambar");
    } finally {
      setUploadingImage(false);
    }
  };

  const uploadSigImage = async (
    id: string,
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok) {
        await fetch(`/api/signatures/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ signatureImage: data.url }),
        });
        loadData();
      } else {
        setMessage("❌ Gagal upload");
      }
    } catch {
      setMessage("❌ Gagal upload");
    }
  };

  const save = async () => {
    if (!form.name.trim() || !form.position.trim()) {
      setMessage("Nama dan jabatan harus diisi");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const url = editingId
        ? `/api/signatures/${editingId}`
        : "/api/signatures";
      const method = editingId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setShowModal(false);
        loadData();
      } else {
        const data = await res.json();
        setMessage(`❌ ${data.error}`);
      }
    } catch {
      setMessage("❌ Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

  const deleteSig = async (id: string) => {
    if (!confirm("Hapus penanda tangan ini?")) return;
    try {
      const res = await fetch(`/api/signatures/${id}`, { method: "DELETE" });
      if (res.ok) loadData();
      else setMessage("❌ Gagal menghapus");
    } catch {
      setMessage("❌ Gagal menghapus");
    }
  };

  const toggleActive = async (s: Signature) => {
    try {
      const res = await fetch(`/api/signatures/${s.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !s.isActive }),
      });
      if (res.ok) loadData();
      else setMessage("❌ Gagal mengubah status");
    } catch {
      setMessage("❌ Gagal mengubah status");
    }
  };

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Penanda Tangan</h1>
          <p className="text-sm text-gray-500 mt-1">
            Kelola daftar penanda tangan sertifikat
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto items-stretch sm:items-center">
          <div className="relative flex-1 sm:w-64">
            <div className="flex items-center">
              <input
                type="text"
                placeholder="Cari nama, jabatan, NIP..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
                className="w-full px-4 py-2.5 pl-10 pr-10 border border-slate-300 rounded-l-xl text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white"
              />
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-10 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
              <button
                onClick={() => {}}
                className="px-4 py-2.5 bg-blue-600 text-white font-semibold rounded-r-xl hover:bg-blue-700 transition-all text-sm whitespace-nowrap"
              >
                Cari
              </button>
            </div>
          </div>
          <button
            onClick={openAdd}
            className="px-4 py-2.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-all shadow-lg text-sm whitespace-nowrap"
          >
            + Tambah
          </button>
        </div>
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

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
        </div>
      ) : filteredSignatures.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          {searchQuery ? "Tidak ada penanda tangan yang cocok" : "Belum ada penanda tangan"}
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 font-semibold text-slate-700">
                  Nama
                </th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">
                  Jabatan
                </th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">
                  NIP
                </th>
                <th className="text-center px-4 py-3 font-semibold text-slate-700">
                  Status
                </th>
                <th className="text-center px-4 py-3 font-semibold text-slate-700">
                  Tanda Tangan
                </th>
                <th className="text-center px-4 py-3 font-semibold text-slate-700">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredSignatures.map((s) => (
                <tr
                  key={s.id}
                  className="border-b border-slate-100 hover:bg-slate-50"
                >
                  <td className="px-4 py-3 font-medium">{s.name}</td>
                  <td className="px-4 py-3 text-slate-500">{s.position}</td>
                  <td className="px-4 py-3 text-slate-500">{s.nip || "-"}</td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                        s.isActive
                          ? "bg-green-100 text-green-700"
                          : "bg-slate-100 text-slate-400"
                      }`}
                    >
                      {s.isActive ? "Aktif" : "Tidak Aktif"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {s.signatureImage ? (
                      <img
                        src={s.signatureImage}
                        alt="TTD"
                        className="h-14 mx-auto object-contain border border-slate-200 rounded-lg p-1 bg-white"
                      />
                    ) : (
                      <label className="px-2 py-1 rounded text-xs font-semibold bg-slate-100 text-slate-500 cursor-pointer hover:bg-slate-200">
                        Upload
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => uploadSigImage(s.id, e)}
                        />
                      </label>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => toggleActive(s)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          s.isActive
                            ? "bg-red-50 text-red-600 hover:bg-red-100"
                            : "bg-green-100 text-green-700 hover:bg-green-200"
                        }`}
                      >
                        {s.isActive ? "Nonaktifkan" : "Aktifkan"}
                      </button>
                      <button
                        onClick={() => openEdit(s)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteSig(s.id)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 text-red-600 hover:bg-red-100"
                      >
                        Hapus
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-lg font-bold text-gray-900 mb-4">
              {editingId ? "Edit Penanda Tangan" : "Tambah Penanda Tangan"}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Nama
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:border-blue-400 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Jabatan
                </label>
                <input
                  type="text"
                  value={form.position}
                  onChange={(e) =>
                    setForm({ ...form, position: e.target.value })
                  }
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:border-blue-400 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  NIP (opsional)
                </label>
                <input
                  type="text"
                  value={form.nip}
                  onChange={(e) => setForm({ ...form, nip: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:border-blue-400 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Tanda Tangan (gambar, opsional)
                </label>
                <div className="flex items-center gap-3">
                  <label className="px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-sm font-semibold cursor-pointer hover:bg-slate-200 transition-all">
                    {uploadingImage ? "Mengupload..." : "Pilih Gambar"}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleUploadImage}
                      className="hidden"
                      disabled={uploadingImage}
                    />
                  </label>
                  {form.signatureImage && (
                    <span className="text-xs text-green-600">
                      ✓ Gambar terupload
                    </span>
                  )}
                </div>
                {form.signatureImage && (
                  <img
                    src={form.signatureImage}
                    alt="Preview"
                    className="mt-2 h-16 object-contain border rounded-lg"
                  />
                )}
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200"
              >
                Batal
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}