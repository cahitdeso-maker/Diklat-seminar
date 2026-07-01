"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Student {
  id: string;
  fullName: string;
  schoolOrigin: string | null;
  unitId: string | null;
}

interface Certificate {
  id: string;
  userId: string;
  title: string;
  fileUrl: string | null;
  issuanceDate: string | null;
  generatedDate: string | null;
  createdAt: string;
}

export default function AdminCertificatesPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [selectedStudent, setSelectedStudent] = useState("");
  const [title, setTitle] = useState("Sertifikat Praktik");
  const [issuanceDate, setIssuanceDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [generating, setGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState<"issue" | "list">("issue");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [studentsRes, certificatesRes] = await Promise.all([
        fetch("/api/students"),
        fetch("/api/certificates"),
      ]);
      const studentsData = await studentsRes.json();
      const certificatesData = await certificatesRes.json();
      setStudents(Array.isArray(studentsData) ? studentsData : []);
      setCertificates(Array.isArray(certificatesData) ? certificatesData : []);
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateCertificate = async () => {
    if (!selectedStudent) {
      setMessage("Pilih mahasiswa terlebih dahulu");
      return;
    }

    setGenerating(true);
    setMessage("");

    try {
      const res = await fetch("/api/certificates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedStudent,
          title,
          issuanceDate,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage("Sertifikat berhasil dibuat");
        loadData();
      } else {
        setMessage(data.error || "Gagal membuat sertifikat");
      }
    } catch {
      setMessage("Terjadi kesalahan");
    } finally {
      setGenerating(false);
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
              Manajemen Sertifikat
            </h1>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab("issue")}
            className={`btn ${activeTab === "issue" ? "btn-primary" : "btn-outline"}`}
          >
            Terbitkan Sertifikat
          </button>
          <button
            onClick={() => setActiveTab("list")}
            className={`btn ${activeTab === "list" ? "btn-primary" : "btn-outline"}`}
          >
            Riwayat Sertifikat
          </button>
        </div>

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

        {activeTab === "issue" && (
          <div className="card max-w-lg">
            <h2 className="font-semibold text-gray-900 mb-4">
              Terbitkan Sertifikat Baru
            </h2>
            <div className="space-y-4">
              <div>
                <label className="label">Mahasiswa *</label>
                <select
                  value={selectedStudent}
                  onChange={(e) => setSelectedStudent(e.target.value)}
                  className="input"
                  required
                >
                  <option value="">Pilih Mahasiswa</option>
                  {students.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.fullName}
                      {student.schoolOrigin ? ` (${student.schoolOrigin})` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Judul Sertifikat</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="input"
                  placeholder="Sertifikat Praktik"
                />
              </div>
              <div>
                <label className="label">Tanggal Penerbitan</label>
                <input
                  type="date"
                  value={issuanceDate}
                  onChange={(e) => setIssuanceDate(e.target.value)}
                  className="input"
                />
              </div>
              <button
                onClick={handleGenerateCertificate}
                disabled={generating}
                className="btn btn-primary w-full"
              >
                {generating ? "Membuat Sertifikat..." : "Terbitkan Sertifikat"}
              </button>
            </div>
          </div>
        )}

        {activeTab === "list" && (
          <div>
            {certificates.length === 0 ? (
              <div className="card text-center py-8">
                <p className="text-gray-500">Belum ada sertifikat</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="text-left p-3 text-sm font-semibold text-gray-700">
                        Mahasiswa
                      </th>
                      <th className="text-left p-3 text-sm font-semibold text-gray-700">
                        Judul
                      </th>
                      <th className="text-left p-3 text-sm font-semibold text-gray-700">
                        Tanggal Terbit
                      </th>
                      <th className="text-left p-3 text-sm font-semibold text-gray-700">
                        Status
                      </th>
                      <th className="text-left p-3 text-sm font-semibold text-gray-700">
                        Aksi
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {certificates.map((cert) => {
                      const student = students.find(
                        (s) => s.id === cert.userId,
                      );
                      return (
                        <tr key={cert.id} className="border-t border-gray-200">
                          <td className="p-3 text-sm text-gray-900">
                            {student?.fullName || "Unknown"}
                          </td>
                          <td className="p-3 text-sm text-gray-600">
                            {cert.title}
                          </td>
                          <td className="p-3 text-sm text-gray-600">
                            {cert.issuanceDate
                              ? new Date(cert.issuanceDate).toLocaleDateString(
                                  "id-ID",
                                )
                              : "-"}
                          </td>
                          <td className="p-3 text-sm">
                            <span
                              className={`badge ${
                                cert.fileUrl ? "badge-success" : "badge-warning"
                              }`}
                            >
                              {cert.fileUrl ? "Siap" : "Proses"}
                            </span>
                          </td>
                          <td className="p-3 text-sm">
                            {cert.fileUrl ? (
                              <a
                                href={cert.fileUrl}
                                download
                                className="btn btn-secondary text-xs"
                              >
                                Unduh PDF
                              </a>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
