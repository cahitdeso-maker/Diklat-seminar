"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface AttendanceRecord {
  id: string;
  userId: string;
  scanTime: string;
  shift: string;
  isLate: boolean;
  locationMap: string | null;
  photoProof: string | null;
  createdAt: string;
  user: {
    fullName: string;
    schoolOrigin: string;
    unitId: string;
  } | null;
}

interface Unit {
  id: string;
  unitName: string;
}

export default function AdminAttendancesPage() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUnit, setSelectedUnit] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [attendanceRes, unitsRes] = await Promise.all([
        fetch("/api/attendance"),
        fetch("/api/units"),
      ]);
      const attendanceData = await attendanceRes.json();
      const unitsData = await unitsRes.json();
      setRecords(Array.isArray(attendanceData) ? attendanceData : []);
      setUnits(Array.isArray(unitsData) ? unitsData : []);
    } catch (error) {
      console.error("Failed to load attendance:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredRecords = selectedUnit
    ? records.filter((r) => r.user?.unitId === selectedUnit)
    : records;

  // Sort by scan time descending
  const sortedRecords = [...filteredRecords].sort(
    (a, b) => new Date(b.scanTime).getTime() - new Date(a.scanTime).getTime(),
  );

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
              Laporan Presensi
            </h1>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Filter */}
        <div className="card mb-6">
          <div className="flex items-center gap-4">
            <label className="label mb-0">Filter Unit:</label>
            <select
              value={selectedUnit}
              onChange={(e) => setSelectedUnit(e.target.value)}
              className="input max-w-xs"
            >
              <option value="">Semua Unit</option>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.unitName}
                </option>
              ))}
            </select>
            <span className="text-sm text-gray-500">
              Total: {sortedRecords.length} presensi
            </span>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="card text-center">
            <p className="text-2xl font-bold text-gray-900">
              {sortedRecords.length}
            </p>
            <p className="text-xs text-gray-500">Total Presensi</p>
          </div>
          <div className="card text-center">
            <p className="text-2xl font-bold text-green-600">
              {sortedRecords.filter((r) => !r.isLate).length}
            </p>
            <p className="text-xs text-gray-500">Tepat Waktu</p>
          </div>
          <div className="card text-center">
            <p className="text-2xl font-bold text-red-600">
              {sortedRecords.filter((r) => r.isLate).length}
            </p>
            <p className="text-xs text-gray-500">Terlambat</p>
          </div>
        </div>

        {/* Attendance Table */}
        {sortedRecords.length === 0 ? (
          <div className="card text-center py-8">
            <p className="text-gray-500">Belum ada data presensi</p>
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
                    Waktu
                  </th>
                  <th className="text-left p-3 text-sm font-semibold text-gray-700">
                    Shift
                  </th>
                  <th className="text-left p-3 text-sm font-semibold text-gray-700">
                    Status
                  </th>
                  <th className="text-left p-3 text-sm font-semibold text-gray-700">
                    Lokasi
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedRecords.map((record) => (
                  <tr key={record.id} className="border-t border-gray-200">
                    <td className="p-3 text-sm text-gray-900">
                      {record.user?.fullName || "Unknown"}
                    </td>
                    <td className="p-3 text-sm text-gray-600">
                      {new Date(record.scanTime).toLocaleString("id-ID")}
                    </td>
                    <td className="p-3 text-sm">
                      <span className="badge badge-info">
                        Shift {record.shift === "P" ? "Pagi" : record.shift}
                      </span>
                    </td>
                    <td className="p-3 text-sm">
                      <span
                        className={`badge ${
                          record.isLate ? "badge-danger" : "badge-success"
                        }`}
                      >
                        {record.isLate ? "Terlambat" : "Tepat Waktu"}
                      </span>
                    </td>
                    <td className="p-3 text-sm">
                      {record.locationMap ? (
                        <a
                          href={record.locationMap}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          Lihat Map
                        </a>
                      ) : (
                        "-"
                      )}
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
