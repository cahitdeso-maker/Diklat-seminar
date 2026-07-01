"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    fullName: "",
    schoolOrigin: "",
    age: "",
    address: "",
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (res.ok) {
        setSuccess(true);
        // Store student ID for later use
        localStorage.setItem("studentId", data.studentId);
      } else {
        setError(data.error || "Gagal mendaftar");
      }
    } catch {
      setError("Terjadi kesalahan jaringan");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="card max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-green-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Registrasi Berhasil!
          </h2>
          <p className="text-gray-600 mb-6">
            Data Anda telah berhasil disimpan. Silakan tunggu persetujuan Admin
            untuk penempatan unit praktik.
          </p>
          <div className="flex gap-3 justify-center">
            <Link href="/" className="btn btn-outline">
              Kembali ke Beranda
            </Link>
            <Link href="/mahasiswa/attendance" className="btn btn-primary">
              Lanjut ke Presensi
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="card max-w-lg w-full">
        <div className="text-center mb-6">
          <Link href="/" className="text-blue-600 text-sm hover:underline">
            &larr; Kembali ke Beranda
          </Link>
          <h2 className="text-2xl font-bold text-gray-900 mt-2">
            Registrasi Praktik
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Isi data diri Anda untuk mendaftar praktik di rumah sakit
          </p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Nama Lengkap *</label>
            <input
              type="text"
              name="fullName"
              value={formData.fullName}
              onChange={handleChange}
              className="input"
              placeholder="Masukkan nama lengkap"
              required
            />
          </div>
          <div>
            <label className="label">Asal Sekolah/Kampus</label>
            <input
              type="text"
              name="schoolOrigin"
              value={formData.schoolOrigin}
              onChange={handleChange}
              className="input"
              placeholder="Nama sekolah atau kampus"
            />
          </div>
          <div>
            <label className="label">Umur</label>
            <input
              type="number"
              name="age"
              value={formData.age}
              onChange={handleChange}
              className="input"
              placeholder="Umur"
              min="15"
              max="60"
            />
          </div>
          <div>
            <label className="label">Alamat</label>
            <textarea
              name="address"
              value={formData.address}
              onChange={handleChange}
              className="input"
              placeholder="Alamat lengkap"
              rows={3}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary w-full py-3"
          >
            {loading ? "Mendaftarkan..." : "Daftar Sekarang"}
          </button>
        </form>

        <p className="text-xs text-gray-500 text-center mt-4">
          Dengan mendaftar, Anda menyetujui syarat dan ketentuan yang berlaku.
        </p>
      </div>
    </div>
  );
}
