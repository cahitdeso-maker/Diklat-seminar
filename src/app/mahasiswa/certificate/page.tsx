"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Certificate {
  id: string;
  title: string;
  fileUrl: string;
  issuanceDate: string;
  generatedDate: string | null;
}

export default function CertificatePage() {
  const [studentId, setStudentId] = useState("");
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    const savedId = localStorage.getItem("studentId");
    if (savedId) {
      setStudentId(savedId);
      loadCertificates(savedId);
    }
  }, []);

  const loadCertificates = async (id: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/certificates?userId=${id}`);
      if (res.ok) {
        const data = await res.json();
        setCertificates(data);
      }
    } catch {
      // silent fail
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!studentId.trim()) {
      setError("Masukkan ID mahasiswa");
      return;
    }
    localStorage.setItem("studentId", studentId);
    await loadCertificates(studentId);
  };

  const handleGenerateCertificate = async () => {
    setGenerating(true);
    setError("");

    try {
      const res = await fetch("/api/certificates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: studentId }),
      });

      const data = await res.json();
      if (res.ok) {
        await loadCertificates(studentId);
      } else {
        setError(data.error || "Gagal membuat sertifikat");
      }
    } catch {
      setError("Terjadi kesalahan jaringan");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-6">
          <Link href="/" className="text-blue-600 text-sm hover:underline">
            &larr; Kembali
          </Link>
          <h2 className="text-2xl font-bold text-gray-900 mt-2">
            Sertifikat Praktik
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Unduh sertifikat praktik Anda
          </p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm mb-4">
            {error}
          </div>
        )}

        <div className="card mb-4">
          <label className="label">ID Mahasiswa</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              className="input flex-1"
              placeholder="Masukkan ID mahasiswa"
            />
            <button onClick={handleSearch} className="btn btn-primary">
              Cari
            </button>
          </div>
        </div>

        {loading && (
          <div className="card text-center">
            <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
            <p className="text-sm text-gray-600 mt-2">Memuat data...</p>
          </div>
        )}

        {!loading && certificates.length > 0 && (
          <div className="space-y-3">
            {certificates.map((cert) => (
              <div
                key={cert.id}
                className="card flex items-center justify-between"
              >
                <div>
                  <h3 className="font-semibold text-gray-900">{cert.title}</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    {cert.issuanceDate
                      ? new Date(cert.issuanceDate).toLocaleDateString("id-ID")
                      : "Tanggal belum ditentukan"}
                  </p>
                  {cert.generatedDate && (
                    <span className="badge badge-success mt-1">
                      Siap diunduh
                    </span>
                  )}
                </div>
                {cert.fileUrl && (
                  <a
                    href={cert.fileUrl}
                    download
                    className="btn btn-secondary text-sm"
                  >
                    Unduh PDF
                  </a>
                )}
              </div>
            ))}
          </div>
        )}

        {!loading && certificates.length === 0 && studentId && (
          <div className="card text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">
              Belum Ada Sertifikat
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Sertifikat akan tersedia setelah Admin menerbitkannya atau Anda
              dapat membuatnya sekarang.
            </p>
            <button
              onClick={handleGenerateCertificate}
              disabled={generating}
              className="btn btn-primary"
            >
              {generating ? "Membuat..." : "Buat Sertifikat"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
