"use client";

import { useState, useEffect } from "react";

interface Settings {
  id: string;
  letterNo: string;
  letterPrefix: string;
  institutionCode: string;
  currentNumber: number;
  year: string;
  format: string;
}

interface User {
  id: string;
  fullName: string;
  email: string;
  role: string;
  institutionName: string | null;
  isActive: boolean;
  createdAt: string;
}

export default function CertificateSettingsPage() {
  const [settings, setSettings] = useState<Settings | null>({
    letterPrefix: "NO : ",
  } as Settings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  // User management state
  const [users, setUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [userForm, setUserForm] = useState({
    fullName: "",
    email: "",
    password: "",
    role: "mahasiswa",
    institutionName: "",
    isActive: true,
  });
  const [userSaving, setUserSaving] = useState(false);
  const [userMessage, setUserMessage] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState("");

  useEffect(() => {
    fetch("/api/certificate-settings")
      .then((r) => r.ok && r.json())
      .then((d) => {
        if (d) {
          d.letterPrefix = d.letterPrefix || "NO : ";
          setSettings(d);
        }
        setLoading(false);
      })
      .catch(() => {
        setMessage("Gagal memuat pengaturan");
        setLoading(false);
      });
  }, []);

  const update = async () => {
    if (!settings) return;
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/certificate-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        setSettings(await res.json());
        setMessage("Pengaturan berhasil disimpan");
      } else {
        setMessage("❌ Gagal menyimpan");
      }
    } catch {
      setMessage("❌ Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

  const generatePreview = () => {
    if (!settings) return "";
    const months = [
      "I", "II", "III", "IV", "V", "VI",
      "VII", "VIII", "IX", "X", "XI", "XII",
    ];
    const monthRoman = months[new Date().getMonth()];
    return settings.format
      .replace("{prefix}", settings.letterPrefix)
      .replace("{letterno}", settings.letterNo)
      .replace("{nomor}", String(settings.currentNumber).padStart(3, "0"))
      .replace("{kode}", settings.institutionCode)
      .replace("{bulan}", monthRoman)
      .replace("{tahun}", settings.year);
  };

  // User management functions
  const loadUsers = async () => {
    try {
      const params = new URLSearchParams();
      if (userSearch) params.append("search", userSearch);
      if (userRoleFilter) params.append("role", userRoleFilter);
      const res = await fetch(`/api/users?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setUsers(data.data || []);
      }
    } catch {
      setUserMessage("❌ Gagal memuat data pengguna");
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [userSearch, userRoleFilter]);

  const openAddUser = () => {
    setEditingUserId(null);
    setUserForm({
      fullName: "",
      email: "",
      password: "",
      role: "mahasiswa",
      institutionName: "",
      isActive: true,
    });
    setShowUserModal(true);
  };

  const openEditUser = (user: User) => {
    setEditingUserId(user.id);
    setUserForm({
      fullName: user.fullName,
      email: user.email,
      password: "",
      role: user.role,
      institutionName: user.institutionName || "",
      isActive: user.isActive,
    });
    setShowUserModal(true);
  };

  const saveUser = async () => {
    if (!userForm.fullName.trim() || !userForm.email.trim()) {
      setUserMessage("Nama lengkap dan email harus diisi");
      return;
    }
    if (!editingUserId && !userForm.password.trim()) {
      setUserMessage("Password harus diisi untuk pengguna baru");
      return;
    }
    setUserSaving(true);
    setUserMessage("");
    try {
      const url = editingUserId ? `/api/users/${editingUserId}` : "/api/users";
      const method = editingUserId ? "PUT" : "POST";
      const body = { ...userForm };
      if (!editingUserId) {
        // For new users, password is required and will be sent
      } else if (!userForm.password) {
        // For editing, if password is empty, don't send it
        delete (body as Record<string, unknown>).password;
      }
      
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setShowUserModal(false);
        loadUsers();
      } else {
        const data = await res.json();
        setUserMessage(`❌ ${data.error}`);
      }
    } catch {
      setUserMessage("❌ Gagal menyimpan pengguna");
    } finally {
      setUserSaving(false);
    }
  };

  const deleteUser = async (id: string) => {
    if (!confirm("Hapus pengguna ini?")) return;
    try {
      const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
      if (res.ok) loadUsers();
      else setUserMessage("❌ Gagal menghapus");
    } catch {
      setUserMessage("❌ Gagal menghapus");
    }
  };

  const toggleUserActive = async (user: User) => {
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !user.isActive }),
      });
      if (res.ok) loadUsers();
      else setUserMessage("❌ Gagal mengubah status");
    } catch {
      setUserMessage("❌ Gagal mengubah status");
    }
  };

  const filteredUsers = users.filter((u) => {
    if (userSearch) {
      const query = userSearch.toLowerCase();
      if (!u.fullName.toLowerCase().includes(query) &&
          !u.email.toLowerCase().includes(query) &&
          !u.role.toLowerCase().includes(query) &&
          !(u.institutionName && u.institutionName.toLowerCase().includes(query))) {
        return false;
      }
    }
    if (userRoleFilter && u.role !== userRoleFilter) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="animate-spin w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
        </div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="p-6">
        <div className="text-center py-12 text-slate-400">
          Pengaturan tidak ditemukan
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Pengaturan Nomor Surat
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Atur format dan nomor surat sertifikat
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

      <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 p-6 space-y-5">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Prefix Surat
          </label>
          <div className="flex items-center">
            <span className="px-3 py-2.5 bg-slate-100 border border-r-0 border-slate-300 rounded-l-xl text-sm font-semibold text-slate-600">
              NO :
            </span>
            <input
              type="text"
              placeholder="421.5"
              value={settings?.letterPrefix?.replace(/^NO\s*:\s*/, "") ?? ""}
              onChange={(e) =>
                setSettings(
                  settings
                    ? { ...settings, letterPrefix: `NO : ${e.target.value}` }
                    : ({ letterPrefix: `NO : ${e.target.value}` } as Settings),
                )
              }
              className="flex-1 px-4 py-2.5 border border-slate-300 rounded-r-xl text-sm focus:border-blue-400 outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Kode Instansi
          </label>
          <input
            type="text"
            value={settings.institutionCode}
            onChange={(e) =>
              setSettings({ ...settings, institutionCode: e.target.value })
            }
            className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:border-blue-400 outline-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Nomor Berikutnya
            </label>
            <input
              type="number"
              value={settings.currentNumber}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  currentNumber: parseInt(e.target.value) || 1,
                })
              }
              className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:border-blue-400 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Tahun
            </label>
            <input
              type="text"
              value={settings.year}
              onChange={(e) =>
                setSettings({ ...settings, year: e.target.value })
              }
              className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:border-blue-400 outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Format Nomor
          </label>
          <input
            type="text"
            value={settings.format}
            onChange={(e) =>
              setSettings({ ...settings, format: e.target.value })
            }
            className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:border-blue-400 outline-none"
          />
          <p className="text-xs text-slate-400 mt-1">
            Gunakan: {"{prefix}"}, {"{letterno}"}, {"{nomor}"}, {"{kode}"},{" "}
            {"{bulan}"}, {"{tahun}"}
          </p>
        </div>

        <div className="bg-slate-50 rounded-xl p-4">
          <p className="text-xs font-semibold text-slate-500 mb-1">Preview</p>
          <p className="text-lg font-bold text-blue-700">{generatePreview()}</p>
        </div>

        <button
          onClick={update}
          disabled={saving}
          className="w-full px-4 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-all shadow-lg disabled:opacity-50 text-sm"
        >
          {saving ? "Menyimpan..." : "Simpan Pengaturan"}
        </button>
      </div>

      {/* Management User Section */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Management User</h2>
            <p className="text-sm text-gray-500 mt-1">
              Kelola pengguna sistem
            </p>
          </div>
          <button
            onClick={openAddUser}
            className="px-4 py-2.5 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 transition-all shadow-lg text-sm"
          >
            + Tambah User
          </button>
        </div>

        {userMessage && (
          <div
            className={`mb-6 px-5 py-4 rounded-xl text-sm ${
              userMessage.startsWith("❌")
                ? "bg-red-50 border border-red-200 text-red-700"
                : "bg-green-50 border border-green-200 text-green-700"
            }`}
          >
            {userMessage}
          </div>
        )}

        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Cari nama, email, role, instansi..."
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              className="w-full px-4 py-2.5 pl-10 border border-slate-300 rounded-xl text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white"
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
            {userSearch && (
              <button
                onClick={() => setUserSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          <select
            value={userRoleFilter}
            onChange={(e) => setUserRoleFilter(e.target.value)}
            className="px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:border-blue-400 focus:outline-none bg-white min-w-[180px]"
          >
            <option value="">Semua Role</option>
            <option value="admin">Admin</option>
            <option value="mahasiswa">Mahasiswa</option>
            <option value="dosen">Dosen</option>
            <option value="koordinator">Koordinator</option>
          </select>
        </div>

        {usersLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            {userSearch || userRoleFilter ? "Tidak ada pengguna yang cocok" : "Belum ada pengguna"}
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 font-semibold text-slate-700">Nama Lengkap</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700">Email</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700">Role</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700">Instansi</th>
                  <th className="text-center px-4 py-3 font-semibold text-slate-700">Status</th>
                  <th className="text-center px-4 py-3 font-semibold text-slate-700">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium">{u.fullName}</td>
                    <td className="px-4 py-3 text-slate-500">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-lg text-xs font-semibold ${
                        u.role === "admin" ? "bg-purple-100 text-purple-700" :
                        u.role === "dosen" ? "bg-blue-100 text-blue-700" :
                        u.role === "koordinator" ? "bg-indigo-100 text-indigo-700" :
                        "bg-green-100 text-green-700"
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{u.institutionName || "-"}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                        u.isActive ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-400"
                      }`}>
                        {u.isActive ? "Aktif" : "Tidak Aktif"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => toggleUserActive(u)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            u.isActive
                              ? "bg-red-50 text-red-600 hover:bg-red-100"
                              : "bg-green-100 text-green-700 hover:bg-green-200"
                          }`}
                        >
                          {u.isActive ? "Nonaktifkan" : "Aktifkan"}
                        </button>
                        <button
                          onClick={() => openEditUser(u)}
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
      </div>

      {/* User Modal */}
      {showUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-lg font-bold text-gray-900 mb-4">
              {editingUserId ? "Edit Pengguna" : "Tambah Pengguna"}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Nama Lengkap
                </label>
                <input
                  type="text"
                  value={userForm.fullName}
                  onChange={(e) => setUserForm({ ...userForm, fullName: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:border-blue-400 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={userForm.email}
                  onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:border-blue-400 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Password {editingUserId ? "(kosongkan jika tidak diubah)" : ""}
                </label>
                <input
                  type="password"
                  value={userForm.password}
                  onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:border-blue-400 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Role
                </label>
                <select
                  value={userForm.role}
                  onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:border-blue-400 outline-none"
                >
                  <option value="mahasiswa">Mahasiswa</option>
                  <option value="dosen">Dosen</option>
                  <option value="koordinator">Koordinator</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Instansi (opsional)
                </label>
                <input
                  type="text"
                  value={userForm.institutionName}
                  onChange={(e) => setUserForm({ ...userForm, institutionName: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:border-blue-400 outline-none"
                />
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={userForm.isActive}
                  onChange={(e) => setUserForm({ ...userForm, isActive: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="isActive" className="ml-2 text-sm text-gray-700">
                  Aktif
                </label>
              </div>
            </div>
            {userMessage && (
              <div
                className={`mt-4 px-4 py-3 rounded-xl text-sm ${
                  userMessage.startsWith("❌")
                    ? "bg-red-50 border border-red-200 text-red-700"
                    : "bg-green-50 border border-green-200 text-green-700"
                }`}
              >
                {userMessage}
              </div>
            )}
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowUserModal(false)}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200"
              >
                Batal
              </button>
              <button
                onClick={saveUser}
                disabled={userSaving}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
              >
                {userSaving ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}