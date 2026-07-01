"use client";

import { useState, useEffect, useMemo } from "react";

interface User {
  id: string;
  role: string;
  fullName: string;
  email: string;
  phoneNumber: string | null;
  institutionName: string | null;
  isActive: boolean;
  createdAt: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    role: "admin",
    fullName: "",
    email: "",
    password: "",
    phoneNumber: "",
    institutionName: "",
    isActive: true,
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const loadData = async () => {
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append("search", searchQuery);
      if (roleFilter) params.append("role", roleFilter);
      if (statusFilter) params.append("isActive", statusFilter);
      const res = await fetch(`/api/users?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setUsers(data.data || []);
      }
    } catch {
      setMessage("Gagal memuat data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [searchQuery, roleFilter, statusFilter]);

  const openAdd = () => {
    setEditingId(null);
    setForm({
      role: "admin",
      fullName: "",
      email: "",
      password: "",
      phoneNumber: "",
      institutionName: "",
      isActive: true,
    });
    setShowModal(true);
  };

  const openEdit = (u: User) => {
    setEditingId(u.id);
    setForm({
      role: u.role,
      fullName: u.fullName,
      email: u.email,
      password: "",
      phoneNumber: u.phoneNumber || "",
      institutionName: u.institutionName || "",
      isActive: u.isActive,
    });
    setShowModal(true);
  };

  const save = async () => {
    if (!form.fullName.trim() || !form.email.trim() || (!editingId && !form.password.trim())) {
      setMessage("Nama lengkap, email, dan password harus diisi");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const url = editingId ? `/api/users/${editingId}` : "/api/users";
      const method = editingId ? "PUT" : "POST";
      const body = editingId ? { ...form, password: form.password || undefined } : form;
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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

  const deleteUser = async (id: string) => {
    if (!confirm("Hapus pengguna ini?")) return;
    try {
      const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
      if (res.ok) loadData();
      else setMessage("❌ Gagal menghapus");
    } catch {
      setMessage("❌ Gagal menghapus");
    }
  };

  const toggleActive = async (u: User) => {
    try {
      const res = await fetch(`/api/users/${u.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !u.isActive }),
      });
      if (res.ok) loadData();
      else setMessage("❌ Gagal mengubah status");
    } catch {
      setMessage("❌ Gagal mengubah status");
    }
  };

  const roles = ["admin", "panitia", "mahasiswa"];

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Management User</h1>
          <p className="text-sm text-gray-500 mt-1">
            Kelola pengguna sistem
          </p>
        </div>
        <button
          onClick={openAdd}
          className="px-4 py-2.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-all shadow-lg text-sm whitespace-nowrap"
        >
          + Tambah User
        </button>
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

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 sm:w-64">
            <input
              type="text"
              placeholder="Cari nama, email, role, institusi..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2.5 pl-10 border border-slate-300 rounded-xl text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-200 outline-none transition-all bg-white"
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
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-200 outline-none transition-all bg-white min-w-[180px]"
          >
            <option value="">Semua Role</option>
            {roles.map((r) => (
              <option key={r} value={r}>
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-200 outline-none transition-all bg-white min-w-[180px]"
          >
            <option value="">Semua Status</option>
            <option value="true">Aktif</option>
            <option value="false">Tidak Aktif</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
        </div>
      ) : users.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          {searchQuery || roleFilter || statusFilter ? "Tidak ada pengguna yang cocok" : "Belum ada pengguna"}
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
                  Email
                </th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">
                  Role
                </th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">
                  Institusi
                </th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">
                  Telepon
                </th>
                <th className="text-center px-4 py-3 font-semibold text-slate-700">
                  Status
                </th>
                <th className="text-center px-4 py-3 font-semibold text-slate-700">
                  Dibuat
                </th>
                <th className="text-center px-4 py-3 font-semibold text-slate-700">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr
                  key={u.id}
                  className="border-b border-slate-100 hover:bg-slate-50"
                >
                  <td className="px-4 py-3 font-medium">{u.fullName}</td>
                  <td className="px-4 py-3 text-slate-500">{u.email}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                        u.role === "admin"
                          ? "bg-purple-100 text-purple-700"
                          : u.role === "panitia"
                          ? "bg-indigo-100 text-indigo-700"
                          : "bg-green-100 text-green-700"
                      }`}
                    >
                      {u.role.charAt(0).toUpperCase() + u.role.slice(1)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{u.institutionName || "-"}</td>
                  <td className="px-4 py-3 text-slate-500">{u.phoneNumber || "-"}</td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                        u.isActive
                          ? "bg-green-100 text-green-700"
                          : "bg-slate-100 text-slate-400"
                      }`}
                    >
                      {u.isActive ? "Aktif" : "Tidak Aktif"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-xs text-slate-400">
                    {new Date(u.createdAt).toLocaleDateString("id-ID", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => toggleActive(u)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          u.isActive
                            ? "bg-red-50 text-red-600 hover:bg-red-100"
                            : "bg-green-100 text-green-700 hover:bg-green-200"
                        }`}
                      >
                        {u.isActive ? "Nonaktifkan" : "Aktifkan"}
                      </button>
                      <button
                        onClick={() => openEdit(u)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteUser(u.id)}
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
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-gray-900 mb-4">
              {editingId ? "Edit Pengguna" : "Tambah Pengguna"}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Role
                </label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:border-blue-400 outline-none"
                >
                  {roles.map((r) => (
                    <option key={r} value={r}>
                      {r.charAt(0).toUpperCase() + r.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Nama Lengkap
                </label>
                <input
                  type="text"
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:border-blue-400 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:border-blue-400 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  {editingId ? "Password Baru (kosongkan jika tidak diubah)" : "Password"}
                </label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:border-blue-400 outline-none"
                  placeholder={editingId ? "••••••••" : "Masukkan password"}
                  required={!editingId}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Telepon (opsional)
                </label>
                <input
                  type="text"
                  value={form.phoneNumber}
                  onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:border-blue-400 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Institusi (opsional)
                </label>
                <input
                  type="text"
                  value={form.institutionName}
                  onChange={(e) => setForm({ ...form, institutionName: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:border-blue-400 outline-none"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 focus:ring-2"
                />
                <label htmlFor="isActive" className="text-sm text-slate-700">
                  Aktif
                </label>
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