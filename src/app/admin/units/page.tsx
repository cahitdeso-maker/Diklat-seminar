"use client";

import { useState, useEffect } from "react";

interface Unit {
  id: string;
  unitName: string;
}

interface Student {
  id: string;
  fullName: string;
  schoolOrigin: string | null;
}

export default function AdminUnitsPage() {
  const [units, setUnits] = useState<Unit[]>([]);
  const [studentsByUnit, setStudentsByUnit] = useState<
    Record<string, Student[]>
  >({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [expandedUnit, setExpandedUnit] = useState<string | null>(null);
  const [newUnitName, setNewUnitName] = useState("");

  // Edit state
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [editName, setEditName] = useState("");

  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [unitsRes, studentsRes] = await Promise.all([
        fetch("/api/units"),
        fetch("/api/units/students"),
      ]);
      const unitsData = await unitsRes.json();
      const studentsData = await studentsRes.json();
      setUnits(Array.isArray(unitsData) ? unitsData : []);
      setStudentsByUnit(studentsData || {});
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStudentCount = (unitId: string) =>
    (studentsByUnit[unitId] || []).length;
  const getStudentList = (unitId: string) => studentsByUnit[unitId] || [];

  // Tambah Unit
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUnitName.trim()) return;
    setMessage("");

    try {
      const res = await fetch("/api/units", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          unitName: newUnitName,
          latitude: 0,
          longitude: 0,
          radius: 100,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage("Unit berhasil ditambahkan");
        setShowForm(false);
        setNewUnitName("");
        loadData();
      } else {
        setMessage(data.error || "Gagal");
      }
    } catch {
      setMessage("Terjadi kesalahan");
    }
  };

  // Edit Unit
  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUnit || !editName.trim()) return;
    setMessage("");

    try {
      const res = await fetch(`/api/units/${editingUnit.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unitName: editName }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage("Unit berhasil diperbarui");
        setEditingUnit(null);
        loadData();
      } else {
        setMessage(data.error || "Gagal");
      }
    } catch {
      setMessage("Terjadi kesalahan");
    }
  };

  // Hapus Unit
  const handleDelete = async (id: string) => {
    setMessage("");

    try {
      const res = await fetch(`/api/units/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        setMessage("Unit berhasil dihapus");
        setDeletingId(null);
        loadData();
      } else {
        setMessage(data.error || "Gagal");
      }
    } catch {
      setMessage("Terjadi kesalahan");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Unit & Mahasiswa
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Kelola unit dan lihat daftar mahasiswa di setiap unit
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-all shadow-lg shadow-blue-500/20"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          {showForm ? "Batal" : "Tambah Unit"}
        </button>
      </div>

      {/* Notifikasi */}
      {message && (
        <div
          className={`p-4 rounded-xl text-sm mb-6 flex items-center gap-3 ${
            message.includes("berhasil")
              ? "bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-500/20"
              : "bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-500/20"
          }`}
        >
          <span
            className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold ${
              message.includes("berhasil") ? "bg-green-500" : "bg-red-500"
            }`}
          >
            {message.includes("berhasil") ? "✓" : "!"}
          </span>
          {message}
        </div>
      )}

      {/* Form Tambah Unit */}
      {showForm && (
        <div className="mb-6 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="p-5 border-b border-gray-100 dark:border-gray-700">
            <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <svg
                className="w-5 h-5 text-blue-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                />
              </svg>
              Tambah Unit Baru
            </h2>
          </div>
          <form onSubmit={handleAdd} className="p-5">
            <div className="flex gap-3">
              <input
                type="text"
                value={newUnitName}
                onChange={(e) => setNewUnitName(e.target.value)}
                className="flex-1 px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                placeholder="Nama unit (contoh: Unit Barokah)"
                required
              />
              <button
                type="submit"
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-all"
              >
                Simpan
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Daftar Unit */}
      {units.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm py-16 text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
            <svg
              className="w-8 h-8 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            </svg>
          </div>
          <h3 className="text-gray-500 dark:text-gray-400 font-medium mb-1">
            Belum Ada Unit
          </h3>
          <p className="text-sm text-gray-400 dark:text-gray-500">
            Klik "Tambah Unit" untuk membuat unit baru
          </p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-5">
          {units.map((unit) => {
            const studentCount = getStudentCount(unit.id);
            const studentList = getStudentList(unit.id);
            const isExpanded = expandedUnit === unit.id;
            const isDeleting = deletingId === unit.id;

            return (
              <div
                key={unit.id}
                className="group bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden"
              >
                {/* Card Header */}
                <div className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-blue-500/20 shrink-0">
                        {unit.unitName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white text-base">
                          {unit.unitName}
                        </h3>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              studentCount > 0
                                ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                                : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
                            }`}
                          >
                            <svg
                              className="w-3 h-3"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                              />
                            </svg>
                            {studentCount} Mahasiswa
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => {
                          setEditingUnit(unit);
                          setEditName(unit.unitName);
                        }}
                        className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-all"
                        title="Edit unit"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                          />
                        </svg>
                      </button>
                      <button
                        onClick={() => setDeletingId(unit.id)}
                        className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
                        title="Hapus unit"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Expand/Collapse Toggle */}
                  {studentCount > 0 && (
                    <button
                      onClick={() =>
                        setExpandedUnit(isExpanded ? null : unit.id)
                      }
                      className="w-full flex items-center justify-between mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                    >
                      <span>Lihat daftar mahasiswa</span>
                      <svg
                        className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </button>
                  )}
                </div>

                {/* Student List */}
                {isExpanded && (
                  <div className="px-5 pb-5">
                    <div className="space-y-2">
                      {studentList.map((student) => (
                        <div
                          key={student.id}
                          className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-700/30 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
                        >
                          <div className="w-9 h-9 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm">
                            {student.fullName
                              .split(" ")
                              .map((n) => n[0])
                              .slice(0, 2)
                              .join("")
                              .toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-800 dark:text-white truncate">
                              {student.fullName}
                            </p>
                            {student.schoolOrigin && (
                              <p className="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5">
                                {student.schoolOrigin}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* No students */}
                {studentCount === 0 && (
                  <div className="px-5 pb-5">
                    <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-3 bg-gray-50 dark:bg-gray-700/30 rounded-xl">
                      Belum ada mahasiswa di unit ini
                    </p>
                  </div>
                )}

                {/* Delete Confirmation */}
                {isDeleting && (
                  <div className="px-5 pb-5">
                    <div className="p-4 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20">
                      <p className="text-sm font-medium text-red-700 dark:text-red-400 mb-3">
                        Hapus unit "{unit.unitName}"?
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleDelete(unit.id)}
                          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-all"
                        >
                          Ya, Hapus
                        </button>
                        <button
                          onClick={() => setDeletingId(null)}
                          className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg transition-all"
                        >
                          Batal
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Edit */}
      {editingUnit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setEditingUnit(null)}
          />
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-blue-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
                Edit Unit
              </h2>
              <button
                onClick={() => setEditingUnit(null)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all"
              >
                <svg
                  className="w-5 h-5 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <form onSubmit={handleEdit}>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Nama Unit
              </label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all mb-4"
                required
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-all"
                >
                  Simpan Perubahan
                </button>
                <button
                  type="button"
                  onClick={() => setEditingUnit(null)}
                  className="px-4 py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-xl transition-all"
                >
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
