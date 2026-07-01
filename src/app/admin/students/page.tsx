"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Student {
  id: string;
  fullName: string;
  schoolOrigin: string | null;
  age: number | null;
  address: string | null;
  unitId: string | null;
  role: string;
  createdAt: string;
}

interface Unit {
  id: string;
  unitName: string;
}

export default function AdminStudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [studentsRes, unitsRes] = await Promise.all([
        fetch("/api/students"),
        fetch("/api/units"),
      ]);
      const studentsData = await studentsRes.json();
      const unitsData = await unitsRes.json();
      setStudents(Array.isArray(studentsData) ? studentsData : []);
      setUnits(Array.isArray(unitsData) ? unitsData : []);
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setLoading(false);
    }
  };

  const assignUnit = async (studentId: string, unitId: string) => {
    try {
      const res = await fetch(`/api/students/${studentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unitId }),
      });

      if (res.ok) {
        setMessage("Unit berhasil diubah");
        loadData();
      } else {
        const data = await res.json();
        setMessage(data.error || "Gagal mengubah unit");
      }
    } catch {
      setMessage("Terjadi kesalahan");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/admin/dashboard"
              className="text-blue-600 text-sm hover:underline"
            >
              &larr; Dashboard
            </Link>
            <h1 className="font-bold text-lg text-gray-800 ml-4">
              Kelola Mahasiswa
            </h1>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {message && (
          <div
            className={`p-3 rounded-lg text-sm mb-4 ${
              message.includes("berhasil")
                ? "bg-green-50 text-green-700"
                : "bg-red-50 text-red-700"
            }`}
          >
            {message}
          </div>
        )}

        {students.length === 0 ? (
          <div className="card text-center py-8">
            <p className="text-gray-500">Belum ada mahasiswa terdaftar</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-100">
                  <th className="text-left p-3 text-sm font-semibold text-gray-700">
                    Nama
                  </th>
                  <th className="text-left p-3 text-sm font-semibold text-gray-700">
                    Asal Sekolah
                  </th>
                  <th className="text-left p-3 text-sm font-semibold text-gray-700">
                    Umur
                  </th>
                  <th className="text-left p-3 text-sm font-semibold text-gray-700">
                    Unit
                  </th>
                  <th className="text-left p-3 text-sm font-semibold text-gray-700">
                    Tanggal Daftar
                  </th>
                  <th className="text-left p-3 text-sm font-semibold text-gray-700">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => (
                  <tr key={student.id} className="border-t border-gray-200">
                    <td className="p-3 text-sm text-gray-900">
                      {student.fullName}
                    </td>
                    <td className="p-3 text-sm text-gray-600">
                      {student.schoolOrigin || "-"}
                    </td>
                    <td className="p-3 text-sm text-gray-600">
                      {student.age || "-"}
                    </td>
                    <td className="p-3 text-sm">
                      <select
                        value={student.unitId || ""}
                        onChange={(e) => assignUnit(student.id, e.target.value)}
                        className="input text-sm py-1"
                      >
                        <option value="">Pilih Unit</option>
                        {units.map((unit) => (
                          <option key={unit.id} value={unit.id}>
                            {unit.unitName}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-3 text-sm text-gray-600">
                      {student.createdAt
                        ? new Date(student.createdAt).toLocaleDateString(
                            "id-ID",
                          )
                        : "-"}
                    </td>
                    <td className="p-3 text-sm">
                      <span
                        className={`badge ${
                          student.unitId ? "badge-success" : "badge-warning"
                        }`}
                      >
                        {student.unitId ? "Sudah ditempatkan" : "Belum"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
