"use client";

import { useState, useEffect, useCallback } from "react";

// ──────────────────────────────────────────
// Types
// ──────────────────────────────────────────
type WaStatus = {
  connected: boolean;
  status: string;
  hasQr: boolean;
  user: {
    id: string;
    name: string;
    number: string;
  } | null;
  queue: {
    pending: number;
    inProgress: number;
  };
  timestamp: string;
};

type QrData = {
  success: boolean;
  qr: string | null;
  message: string;
  status: string;
};

// ──────────────────────────────────────────
// Helper Components
// ──────────────────────────────────────────
function StatusPulse({ status }: { status: string }) {
  const colors: Record<string, string> = {
    connected: "bg-green-500 shadow-green-400",
    connecting: "bg-yellow-500 shadow-yellow-400 animate-pulse",
    qr_required: "bg-blue-500 shadow-blue-400",
    disconnected: "bg-red-500 shadow-red-400",
    logged_out: "bg-red-500 shadow-red-400",
  };

  return (
    <span className="relative flex h-4 w-4">
      <span
        className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${
          status === "connected" ? "bg-green-400 animate-ping" : ""
        }`}
      />
      <span
        className={`relative inline-flex h-4 w-4 rounded-full shadow-lg ${
          colors[status] || "bg-gray-400"
        }`}
      />
    </span>
  );
}

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    connected: "Terhubung",
    connecting: "Menghubungkan...",
    qr_required: "Menunggu Scan QR",
    disconnected: "Terputus",
    logged_out: "Logout",
  };
  return labels[status] || status;
}

function statusColor(status: string): string {
  const colors: Record<string, string> = {
    connected: "text-green-700 bg-green-50 ring-green-200",
    connecting: "text-yellow-700 bg-yellow-50 ring-yellow-200",
    qr_required: "text-blue-700 bg-blue-50 ring-blue-200",
    disconnected: "text-red-700 bg-red-50 ring-red-200",
    logged_out: "text-red-700 bg-red-50 ring-red-200",
  };
  return colors[status] || "text-gray-700 bg-gray-50 ring-gray-200";
}

// ──────────────────────────────────────────
// Main Page
// ──────────────────────────────────────────
export default function WhatsAppAdminPage() {
  const [status, setStatus] = useState<WaStatus | null>(null);
  const [qrData, setQrData] = useState<QrData | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionMsg, setActionMsg] = useState("");
  const [actionMsgType, setActionMsgType] = useState<"success" | "error" | "info">("info");

  // Test message form
  const [testNumber, setTestNumber] = useState("");
  const [testMessage, setTestMessage] = useState("");
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState("");

  // Auto refresh interval
  const [autoRefresh, setAutoRefresh] = useState(true);

  // ── Load Status ──
  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/whatsapp/status");
      const data = await res.json();
      setStatus(data);
      setError("");
    } catch (e: any) {
      setError("Gagal memuat status WhatsApp. Pastikan server wa-gateway aktif.");
    } finally {
      setStatusLoading(false);
    }
  }, []);

  // ── Load QR ──
  const loadQr = useCallback(async () => {
    setQrLoading(true);
    setActionMsg("");
    try {
      const res = await fetch("/api/whatsapp/qr");
      const data = await res.json();
      setQrData(data);

      if (data.success && data.qr) {
        setActionMsgType("info");
        setActionMsg("Scan QR code dengan WhatsApp Anda");
      } else if (data.status === "connected") {
        setActionMsgType("success");
        setActionMsg("WhatsApp sudah terhubung");
      } else if (!data.success) {
        setActionMsgType("error");
        setActionMsg(data.message || "Gagal mendapatkan QR code");
      }
    } catch (e: any) {
      setActionMsgType("error");
      setActionMsg("Gagal terhubung ke server wa-gateway");
    } finally {
      setQrLoading(false);
    }
  }, []);

  // ── Logout ──
  const handleLogout = async () => {
    if (!confirm("Yakin ingin logout dari WhatsApp? Anda perlu scan QR ulang.")) return;
    setActionMsg("");
    try {
      const res = await fetch("/api/whatsapp/logout", {
        method: "POST",
      });
      const data = await res.json();
      setActionMsgType("info");
      setActionMsg("Session WhatsApp telah dihapus. Scan QR ulang untuk menghubungkan.");
      setQrData(null);
      loadStatus();
    } catch (e: any) {
      setActionMsgType("error");
      setActionMsg("Gagal logout");
    }
  };

  // ── Send Test ──
  const handleSendTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testNumber || !testMessage) return;
    setTestSending(true);
    setTestResult("");

    try {
      const res = await fetch("/api/whatsapp/send-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ number: testNumber, message: testMessage }),
      });
      const data = await res.json();
      if (data.success) {
        setTestResult("✅ " + data.message);
        setTestNumber("");
        setTestMessage("");
      } else {
        setTestResult("❌ " + data.message);
      }
    } catch (e: any) {
      setTestResult("❌ Gagal mengirim: " + e.message);
    } finally {
      setTestSending(false);
    }
  };

  // ── Auto-refresh ──
  useEffect(() => {
    loadStatus();
    loadQr();
  }, [loadStatus, loadQr]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(loadStatus, 10000);
    return () => clearInterval(interval);
  }, [autoRefresh, loadStatus]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-green-200/40">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-800">WhatsApp Gateway</h1>
                <p className="text-xs text-slate-500">Manajemen koneksi WhatsApp &amp; Pengiriman Pesan</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-xs text-slate-500 font-medium">Auto-refresh</span>
                <button
                  onClick={() => setAutoRefresh(!autoRefresh)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                    autoRefresh ? "bg-green-500" : "bg-slate-300"
                  }`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform ${
                      autoRefresh ? "translate-x-[18px]" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </label>
              <button
                onClick={loadStatus}
                className="p-2 rounded-xl hover:bg-slate-100 transition-colors"
                title="Refresh status"
              >
                <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-5 py-4 rounded-xl text-sm flex items-center gap-2">
            <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            {error}
          </div>
        )}

        {/* Action Messages */}
        {actionMsg && (
          <div
            className={`mb-6 px-5 py-4 rounded-xl text-sm flex items-center gap-2 border ${
              actionMsgType === "success"
                ? "bg-green-50 border-green-200 text-green-700"
                : actionMsgType === "error"
                  ? "bg-red-50 border-red-200 text-red-700"
                  : "bg-blue-50 border-blue-200 text-blue-700"
            }`}
          >
            {actionMsgType === "success" && (
              <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            )}
            {actionMsgType === "error" && (
              <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            )}
            {actionMsg}
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          {/* ── LEFT COLUMN: Status & QR ── */}
          <div className="lg:col-span-2 space-y-6">
            {/* Connection Status Card */}
            <div className="bg-white rounded-2xl shadow-lg shadow-slate-200/50 border border-slate-100 overflow-hidden">
              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-11 h-11 rounded-xl flex items-center justify-center shadow-lg ${
                      status?.connected
                        ? "bg-gradient-to-br from-green-500 to-emerald-600 shadow-green-200/40"
                        : "bg-gradient-to-br from-red-500 to-rose-600 shadow-red-200/40"
                    }`}
                  >
                    <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      {status?.connected ? (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                      )}
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-800">Status Koneksi</h3>
                    <p className="text-xs text-slate-400">
                      {statusLoading ? "Memuat..." : "Server wa-gateway di 192.168.12.72:3000"}
                    </p>
                  </div>
                </div>
                <span
                  className={`inline-flex items-center gap-2 px-4 py-1.5 text-xs font-semibold rounded-full ring-1 ${
                    statusColor(status?.status || "disconnected")
                  }`}
                >
                  <StatusPulse status={status?.status || "disconnected"} />
                  {statusLabel(status?.status || "disconnected")}
                </span>
              </div>

              {status?.connected && status?.user && (
                <div className="p-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-100">
                      <p className="text-xs font-medium text-green-600 uppercase tracking-wider mb-1">Nomor WhatsApp</p>
                      <p className="text-lg font-bold text-green-900">{status.user.number}</p>
                    </div>
                    <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
                      <p className="text-xs font-medium text-blue-600 uppercase tracking-wider mb-1">Nama Perangkat</p>
                      <p className="text-lg font-bold text-slate-900">{status.user.name || "-"}</p>
                    </div>
                  </div>

                  {/* Queue Info */}
                  <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Antrian Pengiriman</p>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                          <span className="text-xs text-slate-600">
                            Tertunda: <strong>{status.queue.pending}</strong>
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                          <span className="text-xs text-slate-600">
                            Diproses: <strong>{status.queue.inProgress}</strong>
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {!statusLoading && !status?.connected && (
                <div className="p-6">
                  <div className="text-center py-6">
                    <div className="w-20 h-20 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <svg className="w-10 h-10 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                      </svg>
                    </div>
                    <h4 className="text-lg font-semibold text-slate-600 mb-1">WhatsApp Belum Terhubung</h4>
                    <p className="text-sm text-slate-400 mb-2">
                      Status: <span className="font-medium text-slate-500">{statusLabel(status?.status || "disconnected")}</span>
                    </p>
                    <p className="text-xs text-slate-400">
                      Scan QR code di bawah untuk menghubungkan WhatsApp
                    </p>
                  </div>

                  {/* Logout Action */}
                  {status?.status === "logged_out" && (
                    <div className="mt-4 p-4 bg-amber-50 rounded-xl border border-amber-200">
                      <div className="flex items-start gap-3">
                        <svg className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <div>
                          <p className="text-sm font-medium text-amber-800">Session telah logout</p>
                          <p className="text-xs text-amber-700 mt-1">
                            Scan QR code baru untuk menghubungkan ulang. Hapus folder auth_info_baileys jika QR tidak muncul.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* QR Code Card */}
            <div className="bg-white rounded-2xl shadow-lg shadow-slate-200/50 border border-slate-100 overflow-hidden">
              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200/40">
                    <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1-1v2a1 1 0 001 1z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-800">QR Code Pairing</h3>
                    <p className="text-xs text-slate-400">Hubungkan WhatsApp dengan perangkat ini</p>
                  </div>
                </div>
                <button
                  onClick={loadQr}
                  disabled={qrLoading}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-xl text-sm font-semibold hover:bg-blue-100 transition-colors disabled:opacity-50"
                >
                  <svg className={`w-4 h-4 ${qrLoading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  {qrLoading ? "Memuat..." : "Refresh QR"}
                </button>
              </div>

              <div className="p-6">
                {status?.connected ? (
                  <div className="text-center py-8">
                    <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-12 h-12 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <h4 className="text-lg font-semibold text-green-700 mb-1">WhatsApp Sudah Terhubung</h4>
                    <p className="text-sm text-slate-500">
                      Tidak perlu scan QR. Nomor <strong>{status?.user?.number || ""}</strong> sudah terhubung.
                    </p>
                  </div>
                ) : qrData?.qr ? (
                  <div className="flex flex-col items-center">
                    <div className="relative p-4 bg-white rounded-2xl shadow-lg border border-slate-200">
                      {/* QR Code Image */}
                      <img
                        src={qrData.qr}
                        alt="WhatsApp QR Code"
                        className="w-64 h-64 object-contain"
                      />
                    </div>
                    <div className="mt-6 text-center max-w-sm">
                      <div className="flex items-center gap-2 justify-center mb-3">
                        <span className="relative flex h-3 w-3">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500" />
                        </span>
                        <span className="text-sm font-semibold text-blue-700">Menunggu Scan</span>
                      </div>
                      <ol className="text-xs text-slate-500 text-left space-y-2">
                        <li className="flex items-start gap-2">
                          <span className="w-5 h-5 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-[10px] flex-shrink-0 mt-0.5">1</span>
                          <span>Buka <strong>WhatsApp</strong> di HP Anda</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="w-5 h-5 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-[10px] flex-shrink-0 mt-0.5">2</span>
                          <span>Tap ikon <strong>Settings</strong> (⚙️) di pojok kanan bawah</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="w-5 h-5 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-[10px] flex-shrink-0 mt-0.5">3</span>
                          <span>Pilih <strong>Linked Devices</strong> (Perangkat Tertaut)</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="w-5 h-5 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-[10px] flex-shrink-0 mt-0.5">4</span>
                          <span>Tap <strong>Link a Device</strong> dan scan QR code di samping</span>
                        </li>
                      </ol>
                      <p className="mt-4 text-xs text-amber-600 bg-amber-50 p-3 rounded-xl border border-amber-200">
                        ⏱️ QR code akan expired dalam beberapa menit. Klik "Refresh QR" jika sudah kedaluwarsa.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="w-20 h-20 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <svg className="w-10 h-10 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1-1v2a1 1 0 001 1z" />
                      </svg>
                    </div>
                    <h4 className="text-lg font-semibold text-slate-600 mb-1">QR Code Belum Tersedia</h4>
                    <p className="text-sm text-slate-400 mb-4">
                      {statusLoading ? "Memuat status koneksi..." : "Klik tombol Refresh QR untuk mendapatkan QR code"}
                    </p>
                    {!statusLoading && (
                      <button
                        onClick={loadQr}
                        disabled={qrLoading}
                        className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-sm font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg shadow-blue-200/40 disabled:opacity-50"
                      >
                        <svg className={`w-4 h-4 ${qrLoading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        {qrLoading ? "Memuat..." : "Dapatkan QR Code"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── RIGHT COLUMN: Actions ── */}
          <div className="space-y-6">
            {/* Send Test Message */}
            <div className="bg-white rounded-2xl shadow-lg shadow-slate-200/50 border border-slate-100 overflow-hidden">
              <div className="px-6 py-5 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-200/40">
                    <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-800">Test Kirim Pesan</h3>
                    <p className="text-xs text-slate-400">Coba kirim pesan WhatsApp</p>
                  </div>
                </div>
              </div>

              <form onSubmit={handleSendTest} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Nomor Tujuan
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-slate-400 text-sm font-medium">+62</span>
                    </div>
                    <input
                      type="tel"
                      value={testNumber}
                      onChange={(e) => setTestNumber(e.target.value)}
                      placeholder="81234567890"
                      className="w-full pl-12 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      disabled={testSending || !status?.connected}
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">Cukup angka, tanpa 0 atau 62 di awal</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Pesan
                  </label>
                  <textarea
                    value={testMessage}
                    onChange={(e) => setTestMessage(e.target.value)}
                    placeholder="Ketik pesan yang akan dikirim..."
                    rows={3}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
                    disabled={testSending || !status?.connected}
                  />
                </div>

                {testResult && (
                  <div
                    className={`px-4 py-3 rounded-xl text-xs font-medium ${
                      testResult.startsWith("✅")
                        ? "bg-green-50 text-green-700 border border-green-200"
                        : "bg-red-50 text-red-700 border border-red-200"
                    }`}
                  >
                    {testResult}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={testSending || !status?.connected || !testNumber || !testMessage}
                  className="w-full inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl text-sm font-semibold hover:from-green-700 hover:to-emerald-700 transition-all shadow-lg shadow-green-200/40 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {testSending ? (
                    <>
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Mengirim...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                      Kirim Pesan
                    </>
                  )}
                </button>

                {!status?.connected && (
                  <p className="text-xs text-amber-600 text-center">
                    ⚠️ WhatsApp belum terhubung. Scan QR code terlebih dahulu.
                  </p>
                )}
              </form>
            </div>

            {/* Actions Card */}
            <div className="bg-white rounded-2xl shadow-lg shadow-slate-200/50 border border-slate-100 p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-rose-500 to-rose-600 rounded-xl flex items-center justify-center shadow-lg shadow-rose-200/40">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800">Pengaturan</h3>
                  <p className="text-xs text-slate-400">Opsi lanjutan</p>
                </div>
              </div>
              <div className="space-y-3">
                <button
                  onClick={handleLogout}
                  disabled={!status?.connected && status?.status !== "logged_out"}
                  className="w-full flex items-center gap-3 p-4 bg-gradient-to-r from-rose-50 to-red-50 rounded-xl hover:from-rose-100 hover:to-red-100 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
                    <svg className="w-5 h-5 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-medium text-slate-800">Logout WhatsApp</p>
                    <p className="text-xs text-slate-500">Hapus session &amp; pairing ulang</p>
                  </div>
                  <svg className="w-5 h-5 text-slate-300 group-hover:text-rose-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>

                <div className="p-4 bg-gradient-to-br from-slate-50 to-blue-50 rounded-xl border border-slate-200">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-600">Informasi Server</p>
                      <p className="text-[10px] text-slate-400 mt-1">
                        wa-gateway: 192.168.12.72:3000
                      </p>
                      <p className="text-[10px] text-slate-400">
                        Status terakhir: {status?.timestamp ? new Date(status.timestamp).toLocaleTimeString("id-ID") : "-"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white/50 backdrop-blur-sm border-t border-slate-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <p className="text-center text-sm text-slate-500">
            &copy; {new Date().getFullYear()} Diklat RS PKU Muhammadiyah Gombong. WhatsApp Gateway v1.0
          </p>
        </div>
      </footer>
    </div>
  );
}
