"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import QRCode from "react-qr-code";
import { toPng } from "html-to-image";

interface PrintData {
  id: string;
  fullName: string;
  email: string | null;
  phoneNumber: string | null;
  institution: string | null;
  profession: string | null;
  qrCode: string;
  seminarTitle: string;
  seminarDate: string;
  seminarLocation: string | null;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function PrintRegistrationPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const cardRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<PrintData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);

  const isDownload = searchParams.get("download") === "1";

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`/api/print-registration/${params.id}`);
        if (!res.ok) {
          const err = await res.json();
          setError(err.error || "Gagal memuat data");
          return;
        }
        const result = await res.json();
        setData(result);
      } catch {
        setError("Gagal memuat data pendaftaran");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [params.id]);

  useEffect(() => {
    if (!loading && data && !isDownload) {
      const timer = setTimeout(() => {
        window.print();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [loading, data, isDownload]);

  const handleDownload = useCallback(async () => {
    if (!cardRef.current || !data) return;
    setDownloading(true);
    try {
      const dataUrl = await toPng(cardRef.current, {
        quality: 1,
        pixelRatio: 2,
        cacheBust: true,
      });
      const link = document.createElement("a");
      link.download = `kartu-peserta-${data.fullName.replace(/\s+/g, "-").toLowerCase()}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Download error:", err);
    } finally {
      setDownloading(false);
    }
  }, [data]);

  if (loading) {
    return (
      <div className="print-loading">
        <p>Memuat data...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="print-loading">
        <p>{error || "Data tidak ditemukan"}</p>
        <button onClick={() => window.close()}>Tutup</button>
      </div>
    );
  }

  return (
    <div className="print-container">
      {/* Action buttons - only visible on screen */}
      {isDownload && (
        <div className="action-bar">
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="action-btn download-btn"
          >
            {downloading ? (
              <>
                <span className="spinner"></span>
                Mendownload...
              </>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                </svg>
                Download Kartu
              </>
            )}
          </button>
          <button
            onClick={() => window.print()}
            className="action-btn print-btn"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6v-8z" />
            </svg>
            Cetak Kartu
          </button>
        </div>
      )}

      <div className="card" ref={cardRef}>
        {/* Header */}
        <div className="card-header">
          <div className="header-top">
            <div className="institution-badge">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div className="header-text">
              <h1>KARTU PESERTA</h1>
              <p>RS PKU Muhammadiyah Gombong</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="card-body">
          {/* Left: Info */}
          <div className="info-section">
            <div className="info-row">
              <span className="label">Nama</span>
              <span className="separator">:</span>
              <span className="value">{data.fullName}</span>
            </div>
            <div className="info-row">
              <span className="label">Instansi</span>
              <span className="separator">:</span>
              <span className="value">{data.institution || "-"}</span>
            </div>
            <div className="info-row">
              <span className="label">Seminar</span>
              <span className="separator">:</span>
              <span className="value">{data.seminarTitle}</span>
            </div>
            <div className="info-row">
              <span className="label">Tanggal</span>
              <span className="separator">:</span>
              <span className="value">{formatDate(data.seminarDate)}</span>
            </div>
            <div className="info-row">
              <span className="label">Lokasi</span>
              <span className="separator">:</span>
              <span className="value">{data.seminarLocation || "-"}</span>
            </div>
          </div>

          {/* Right: QR Code */}
          <div className="qr-section">
            <div className="qr-box">
              <QRCode value={data.qrCode} size={130} level="Q" />
            </div>
            <div className="qr-label">QR CODE PESERTA</div>
            <div className="qr-code-text">{data.qrCode}</div>
          </div>
        </div>

        {/* Footer */}
        <div className="card-footer">
          <p>Kartu ini digunakan untuk presensi kehadiran seminar. Simpan dengan baik.</p>
        </div>
      </div>

      <style jsx>{`
        .print-container {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: #e2e8f0;
          padding: 24px;
          gap: 20px;
        }

        .action-bar {
          width: 800px;
          max-width: 100%;
          display: flex;
          justify-content: center;
          gap: 12px;
        }

        .action-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 12px 28px;
          border: none;
          border-radius: 10px;
          font-family: 'Segoe UI', Arial, sans-serif;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .download-btn {
          background: #2563eb;
          color: white;
          box-shadow: 0 2px 8px rgba(37, 99, 235, 0.3);
        }

        .download-btn:hover {
          background: #1d4ed8;
        }

        .download-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .print-btn {
          background: #059669;
          color: white;
          box-shadow: 0 2px 8px rgba(5, 150, 105, 0.3);
        }

        .print-btn:hover {
          background: #047857;
        }

        .spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .card {
          width: 800px;
          min-height: 480px;
          background: #ffffff;
          border-radius: 16px;
          box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          border: 1px solid #e2e8f0;
        }

        /* ===== HEADER ===== */
        .card-header {
          background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
          padding: 20px 32px;
        }

        .header-top {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .institution-badge {
          width: 48px;
          height: 48px;
          background: rgba(255, 255, 255, 0.2);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          flex-shrink: 0;
        }

        .header-text h1 {
          font-family: 'Segoe UI', Arial, sans-serif;
          font-size: 22px;
          font-weight: 800;
          color: white;
          margin: 0;
          letter-spacing: 2px;
          text-transform: uppercase;
        }

        .header-text p {
          font-family: 'Segoe UI', Arial, sans-serif;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.85);
          margin: 2px 0 0 0;
          font-weight: 500;
        }

        /* ===== BODY ===== */
        .card-body {
          flex: 1;
          display: flex;
          padding: 28px 32px;
          gap: 24px;
        }

        .info-section {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 10px;
        }

        .info-row {
          display: flex;
          align-items: baseline;
          gap: 8px;
        }

        .label {
          font-family: 'Segoe UI', Arial, sans-serif;
          font-size: 13px;
          font-weight: 600;
          color: #64748b;
          min-width: 72px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .separator {
          font-family: 'Segoe UI', Arial, sans-serif;
          font-size: 13px;
          color: #94a3b8;
          min-width: 8px;
        }

        .value {
          font-family: 'Segoe UI', Arial, sans-serif;
          font-size: 15px;
          font-weight: 600;
          color: #0f172a;
        }

        .qr-section {
          width: 180px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          border-left: 2px dashed #e2e8f0;
          padding-left: 24px;
          gap: 8px;
        }

        .qr-box {
          background: #f8fafc;
          padding: 10px;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
        }

        .qr-label {
          font-family: 'Segoe UI', Arial, sans-serif;
          font-size: 10px;
          font-weight: 700;
          color: #64748b;
          letter-spacing: 1.5px;
          text-align: center;
        }

        .qr-code-text {
          font-family: 'Courier New', monospace;
          font-size: 9px;
          color: #94a3b8;
          text-align: center;
          word-break: break-all;
          line-height: 1.4;
        }

        /* ===== FOOTER ===== */
        .card-footer {
          background: #f8fafc;
          border-top: 1px solid #e2e8f0;
          padding: 10px 32px;
          text-align: center;
        }

        .card-footer p {
          font-family: 'Segoe UI', Arial, sans-serif;
          font-size: 10px;
          color: #94a3b8;
          margin: 0;
          font-style: italic;
        }

        @media print {
          @page {
            size: landscape;
            margin: 0;
          }

          body {
            margin: 0;
            padding: 0;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .print-container {
            min-height: auto;
            background: none;
            padding: 0;
            gap: 0;
          }

          .action-bar {
            display: none;
          }

          .card {
            border-radius: 0;
            box-shadow: none;
            width: 100vw;
            height: 100vh;
            max-width: 100%;
            max-height: 100%;
            border: none;
          }

          .card-header {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .print-loading {
            display: none;
          }
        }
      `}</style>

      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-container,
          .print-container * {
            visibility: visible;
          }
          .print-container {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
          }
        }

        .print-loading {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          font-family: 'Segoe UI', Arial, sans-serif;
          font-size: 18px;
          color: #64748b;
          gap: 16px;
        }

        .print-loading button {
          padding: 8px 24px;
          background: #3b82f6;
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
        }
      `}</style>
    </div>
  );
}