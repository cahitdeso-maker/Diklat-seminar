"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { FaceCamera } from "@/lib/face-camera";
import { detectFaces, cropFace, loadFaceLandmarkerModel } from "@/services/FaceDetectionService";
import { validateFaceQuality } from "@/services/FaceQualityService";
import { generateEmbedding } from "@/services/FaceRecognitionService";
import { EmbeddingService } from "@/services/EmbeddingService";
import { FaceLivenessService } from "@/lib/face-liveness";

function debugLog(...args: unknown[]): void {
  if (process.env.NODE_ENV === "development") {
    console.log("[PresensiPage]", ...args);
  }
}

export default function PresensiPage() {
  const [step, setStep] = useState<"cari" | "result" | "done">("cari");
  const [searchType, setSearchType] = useState<"qr" | "face">("qr");
  const [qrCode, setQrCode] = useState("");
  const [participant, setParticipant] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Face ID states
  const [scanning, setScanning] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [faceStatus, setFaceStatus] = useState("");
  const [faceReady, setFaceReady] = useState(false);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [similarityScore, setSimilarityScore] = useState(0);
  const [livenessProgress, setLivenessProgress] = useState(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const faceCameraRef = useRef<FaceCamera | null>(null);
  const livenessRef = useRef<FaceLivenessService | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const isDetectingRef = useRef(false);
  const previousLandmarksRef = useRef<Float32Array | null>(null);
  const isMountedRef = useRef(true);

  const cleanupDetection = useCallback(() => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    isDetectingRef.current = false;
  }, []);

  const stopCamera = useCallback(() => {
    cleanupDetection();
    if (faceCameraRef.current) {
      faceCameraRef.current.stop();
      faceCameraRef.current = null;
    }
    livenessRef.current = null;
    previousLandmarksRef.current = null;
    setScanning(false);
    setVerifying(false);
    setFaceReady(false);
    setFaceStatus("");
    setLivenessProgress(0);
  }, [cleanupDetection]);

  // Load models on mount
  useEffect(() => {
    isMountedRef.current = true;
    loadModels();
    return () => {
      isMountedRef.current = false;
      cleanupDetection();
      stopCamera();
    };
  }, []);

  const loadModels = async () => {
    try {
      await loadFaceLandmarkerModel();
      if (isMountedRef.current) {
        setModelsLoading(false);
        debugLog("MediaPipe model loaded");
      }
    } catch (err: any) {
      if (isMountedRef.current) {
        setError(err.message || "Gagal memuat model face recognition");
        setModelsLoading(false);
      }
    }
  };

  // Start/stop camera when switching to/from face mode
  useEffect(() => {
    if (step === "cari" && searchType === "face") {
      // Small delay to ensure video element is rendered
      const timer = setTimeout(() => {
        startFaceScan();
      }, 300);
      return () => clearTimeout(timer);
    } else {
      cleanupDetection();
      stopCamera();
    }
  }, [step, searchType]);

  const startFaceScan = async () => {
    if (!videoRef.current || modelsLoading) return;
    if (!isMountedRef.current) return;

    setError("");
    setScanning(true);
    setFaceStatus("Mengakses kamera...");
    debugLog("starting face scan");

    try {
      const camera = new FaceCamera();
      faceCameraRef.current = camera;
      livenessRef.current = new FaceLivenessService();

      // Wait for camera to be fully ready (loadedmetadata, loadeddata, canplay, playing)
      await camera.start(videoRef.current);
      debugLog("camera started and ready");

      if (!isMountedRef.current) {
        stopCamera();
        return;
      }

      // Start real-time face detection using requestAnimationFrame
      startFaceDetectionLoop();
    } catch (err: any) {
      debugLog("camera start failed:", err);
      if (isMountedRef.current) {
        setError(err.message || "Tidak dapat mengakses kamera");
        setScanning(false);
      }
    }
  };

  const startFaceDetectionLoop = () => {
    if (!videoRef.current || !faceCameraRef.current) return;
    if (!faceCameraRef.current.isReady()) {
      debugLog("camera not ready yet, retrying...");
      animationFrameRef.current = requestAnimationFrame(startFaceDetectionLoop);
      return;
    }

    debugLog("detection loop started");
    detectionLoop(performance.now());
  };

  const detectionLoop = async (timestamp: number) => {
    if (!isMountedRef.current) return;

    // Prevent concurrent detection
    if (isDetectingRef.current) {
      animationFrameRef.current = requestAnimationFrame(detectionLoop);
      return;
    }

    const video = videoRef.current;
    const camera = faceCameraRef.current;
    if (!video || !camera) return;

    // Check camera readiness
    if (!camera.isReady()) {
      animationFrameRef.current = requestAnimationFrame(detectionLoop);
      return;
    }

    isDetectingRef.current = true;

    try {
      const result = await detectFaces(video, timestamp);

      if (!isMountedRef.current) return;

      if (!result.detected) {
        setFaceStatus("Wajah tidak terdeteksi");
        setFaceReady(false);
        isDetectingRef.current = false;
        animationFrameRef.current = requestAnimationFrame(detectionLoop);
        return;
      }

      if (result.faceCount > 1) {
        setFaceStatus("Terlalu banyak wajah");
        setFaceReady(false);
        isDetectingRef.current = false;
        animationFrameRef.current = requestAnimationFrame(detectionLoop);
        return;
      }

      // Check quality
      const quality = validateFaceQuality(result, video.videoWidth, video.videoHeight);

      // Check liveness
      if (result.landmarks && result.landmarks.length > 0 && livenessRef.current) {
        const liveness = livenessRef.current.checkLiveness(result.landmarks[0]);

        // Check if likely a photo
        if (previousLandmarksRef.current && livenessRef.current.isLikelyPhoto(result.landmarks[0], previousLandmarksRef.current)) {
          setFaceStatus("Terdeteksi sebagai foto! Gerakkan wajah Anda");
          setFaceReady(false);
          previousLandmarksRef.current = result.landmarks[0];
          isDetectingRef.current = false;
          animationFrameRef.current = requestAnimationFrame(detectionLoop);
          return;
        }
        previousLandmarksRef.current = result.landmarks[0];

        setLivenessProgress(liveness.progress);

        // Update status
        if (quality.score >= 70 && liveness.passed) {
          setFaceStatus("Wajah siap diverifikasi ✓");
          setFaceReady(true);
        } else if (quality.score < 70) {
          setFaceStatus(quality.messages[0] || "Posisikan wajah dengan benar");
          setFaceReady(false);
        } else {
          setFaceStatus(liveness.message);
          setFaceReady(false);
        }
      }
    } catch (err) {
      // Log error but continue scanning - never crash the attendance process
      console.error("[PresensiPage] detection loop error:", err);
    }

    isDetectingRef.current = false;

    // Schedule next frame
    if (isMountedRef.current) {
      animationFrameRef.current = requestAnimationFrame(detectionLoop);
    }
  };

  const captureAndVerify = async () => {
    const camera = faceCameraRef.current;
    const video = videoRef.current;
    if (!camera || !canvasRef.current || !video || verifying) return;
    if (!camera.isReady()) {
      setError("Kamera belum siap. Silakan coba lagi.");
      return;
    }

    setVerifying(true);
    setFaceStatus("Memverifikasi wajah...");
    setError("");
    debugLog("starting face verification");

    try {
      // Get face detection for cropping
      const timestamp = performance.now();
      const result = await detectFaces(video, timestamp);

      if (!result.detected || !result.faceRect) {
        setError("Wajah tidak terdeteksi");
        setVerifying(false);
        return;
      }

      // Crop face from video frame using bounding box
      setFaceStatus("Mengambil gambar wajah...");
      const croppedFace = cropFace(video, result.faceRect);
      debugLog("face cropped for recognition", {
        width: croppedFace.width,
        height: croppedFace.height,
      });

      if (croppedFace.width === 0 || croppedFace.height === 0) {
        setError("Gagal mengambil gambar wajah. Silakan coba lagi.");
        setVerifying(false);
        return;
      }

      // Generate embedding from cropped face image (ONNX model)
      setFaceStatus("Menghasilkan embedding wajah...");
      const recognitionResult = await generateEmbedding(croppedFace);

      if (!recognitionResult.success || recognitionResult.embedding.length === 0) {
        setError("Gagal menghasilkan embedding wajah. Silakan coba lagi.");
        setVerifying(false);
        return;
      }

      debugLog("embedding generated", {
        dim: recognitionResult.embedding.length,
        method: recognitionResult.method,
        time: `${recognitionResult.inferenceTime}ms`,
      });

      // Normalize embedding
      const capturedEmbedding = EmbeddingService.normalize(recognitionResult.embedding);

      // Fetch all registrations with face embeddings for this seminar
      const res = await fetch("/api/attendance/face/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          embedding: capturedEmbedding,
        }),
      });

      const data = await res.json();
      debugLog("verification result", data);

      if (res.ok && data.match) {
        // Check if presensi is open for this participant's seminar
        const presensiRes = await fetch(`/api/seminars/${data.participant.seminarId}/presensi-status`);
        if (presensiRes.ok) {
          const presensiData = await presensiRes.json();
          if (!presensiData.open) {
            setError("Presensi untuk seminar ini sedang ditutup oleh admin");
            setVerifying(false);
            return;
          }
        }
        setSimilarityScore(data.similarity);
        setParticipant(data.participant);
        setStep("result");
        stopCamera();
      } else {
        setError(data.error || "Wajah tidak cocok dengan data registrasi");
        setVerifying(false);
      }
    } catch (err: any) {
      debugLog("verification error:", err);
      setError(err.message || "Gagal memverifikasi wajah");
      setVerifying(false);
    }
  };

  const searchByQr = async () => {
    if (!qrCode.trim()) {
      setError("Masukkan kode QR");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/registrations`);
      if (res.ok) {
        const all = await res.json();
        const found = Array.isArray(all)
          ? all.find((r: any) => r.qrCode === qrCode.trim().toUpperCase())
          : null;
        if (found) {
          // Check if presensi is open for this participant's seminar
          const presensiRes = await fetch(`/api/seminars/${found.seminarId}/presensi-status`);
          if (presensiRes.ok) {
            const presensiData = await presensiRes.json();
            if (!presensiData.open) {
              setError("Presensi untuk seminar ini sedang ditutup oleh admin");
              setLoading(false);
              return;
            }
          }
          setParticipant(found);
          setStep("result");
        } else {
          setError("Kode QR tidak ditemukan");
        }
      }
    } catch {
      setError("Gagal mencari");
    } finally {
      setLoading(false);
    }
  };

  const markPresent = async () => {
    if (!participant) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/registrations?id=${participant.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPresent: true, presentMethod: searchType === "face" ? "face" : "qr" }),
      });
      if (res.ok) {
        setStep("done");
      } else {
        setError("Gagal presensi");
      }
    } catch {
      setError("Gagal");
    } finally {
      setLoading(false);
    }
  };

  const resetSearch = () => {
    setStep("cari");
    setParticipant(null);
    setQrCode("");
    setError("");
    setSimilarityScore(0);
    setLivenessProgress(0);
    stopCamera();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-100 sticky top-0 z-50">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center shadow-sm">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
            </div>
            <span className="text-base font-bold text-slate-800">Presensi</span>
          </Link>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-8">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-slate-800">Presensi Peserta</h2>
          <p className="text-sm text-slate-500 mt-1">
            Scan QR Code atau verifikasi dengan Face ID
          </p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm mb-4">
            {error}
          </div>
        )}

        {modelsLoading && (
          <div className="bg-blue-50 text-blue-600 p-3 rounded-xl text-sm mb-4 flex items-center gap-2">
            <div className="animate-spin w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
            Memuat model Face Recognition...
          </div>
        )}

        {/* Toggle search type */}
        {step === "cari" && (
          <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 p-6">
            <div className="flex bg-slate-100 rounded-xl p-1 mb-6">
              <button
                onClick={() => {
                  setSearchType("qr");
                  stopCamera();
                }}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${searchType === "qr" ? "bg-white shadow-sm text-blue-600" : "text-slate-500"}`}
              >
                QR Code
              </button>
              <button
                onClick={() => setSearchType("face")}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${searchType === "face" ? "bg-white shadow-sm text-blue-600" : "text-slate-500"}`}
              >
                Face ID
              </button>
            </div>

            {searchType === "qr" ? (
              <div className="space-y-4">
                <div className="text-center">
                  <div className="w-20 h-20 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-10 h-10 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                    </svg>
                  </div>
                  <p className="text-sm text-slate-500 mb-4">Masukkan kode QR peserta</p>
                </div>
                <input
                  type="text"
                  value={qrCode}
                  onChange={(e) => setQrCode(e.target.value.toUpperCase())}
                  placeholder="SEMINAR-XXXX-XXXX"
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm font-mono tracking-wider focus:border-blue-400 outline-none text-center uppercase"
                />
                <button
                  onClick={searchByQr}
                  disabled={loading}
                  className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-60 shadow-lg shadow-blue-200/50"
                >
                  {loading ? "Mencari..." : "Cari"}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="text-center">
                  <div className="w-20 h-20 bg-gradient-to-br from-green-50 to-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-10 h-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <p className="text-sm text-slate-500 mb-4">
                    Arahkan wajah ke kamera untuk verifikasi
                  </p>
                </div>

                {/* Camera View */}
                <div className="relative aspect-[4/3] bg-black rounded-xl overflow-hidden">
                  <video
                    ref={videoRef}
                    className={`w-full h-full object-cover ${scanning ? "" : "hidden"}`}
                    autoPlay
                    playsInline
                    muted
                  />
                  {!scanning && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
                      <svg className="w-16 h-16 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <p className="text-center px-4 text-sm">Kamera akan muncul di sini</p>
                    </div>
                  )}

                  {/* Face guide overlay */}
                  {scanning && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className={`w-44 h-52 border-2 rounded-2xl transition-all duration-300 ${
                        faceReady ? "border-green-400 bg-green-500/10" : "border-blue-400 bg-blue-500/5"
                      }`}>
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-40 border-2 rounded-full border-dashed opacity-40"></div>
                      </div>
                    </div>
                  )}

                  {/* Status indicator */}
                  {scanning && (
                    <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                      <div className={`px-3 py-1.5 rounded-lg text-xs font-medium backdrop-blur-sm ${
                        faceReady
                          ? "bg-green-500/80 text-white"
                          : faceStatus.includes("tidak")
                          ? "bg-red-500/80 text-white"
                          : "bg-blue-500/80 text-white"
                      }`}>
                        <span className="flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            faceReady ? "bg-white animate-pulse" : "bg-white/70"
                          }`}></span>
                          {faceStatus || "Memindai..."}
                        </span>
                      </div>
                      {verifying && (
                        <div className="px-3 py-1.5 bg-black/60 backdrop-blur-sm rounded-lg text-xs text-white">
                          <span className="flex items-center gap-1.5">
                            <div className="animate-spin w-3 h-3 border-2 border-white border-t-transparent rounded-full"></div>
                            Memverifikasi...
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Liveness progress */}
                  {scanning && livenessProgress > 0 && livenessProgress < 100 && (
                    <div className="absolute bottom-16 left-1/2 -translate-x-1/2 w-3/4">
                      <div className="bg-black/60 backdrop-blur-sm rounded-lg p-2">
                        <div className="flex items-center justify-between text-xs text-white mb-1">
                          <span>Verifikasi liveness</span>
                          <span>{livenessProgress}%</span>
                        </div>
                        <div className="w-full bg-white/20 rounded-full h-1.5">
                          <div
                            className="bg-green-400 h-1.5 rounded-full transition-all duration-300"
                            style={{ width: `${livenessProgress}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Verify button */}
                  {scanning && faceReady && !verifying && (
                    <button
                      onClick={captureAndVerify}
                      className="absolute bottom-4 left-1/2 -translate-x-1/2 px-6 py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 transition-colors shadow-lg animate-pulse"
                    >
                      Verifikasi Wajah Sekarang
                    </button>
                  )}

                  {scanning && !faceReady && !verifying && (
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
                      <button
                        onClick={stopCamera}
                        className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors shadow-lg"
                      >
                        Hentikan Scan
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {step === "result" && participant && (
          <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 p-6">
            <div className="text-center mb-6">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3 ${participant.isPresent ? "bg-green-100" : "bg-blue-100"}`}>
                <svg className={`w-8 h-8 ${participant.isPresent ? "text-green-600" : "text-blue-600"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={participant.isPresent ? "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" : "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"} />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-slate-800">{participant.fullName}</h3>
              <p className="text-sm text-slate-500">{participant.email || participant.phoneNumber}</p>
            </div>

            <div className="bg-slate-50 rounded-xl p-4 mb-6 space-y-2 text-sm">
              <p><span className="text-slate-400">Institusi:</span> {participant.institution || "-"}</p>
              <p><span className="text-slate-400">Profesi:</span> {participant.profession || "-"}</p>
              <p>
                <span className="text-slate-400">Status:</span>{" "}
                {participant.isPresent ? (
                  <span className="text-green-600 font-semibold">✓ Sudah Presensi</span>
                ) : (
                  <span className="text-amber-600 font-semibold">Belum Presensi</span>
                )}
              </p>
              {participant.presentTime && (
                <p><span className="text-slate-400">Waktu:</span> {new Date(participant.presentTime).toLocaleString("id-ID")}</p>
              )}
            </div>

            {!participant.isPresent ? (
              <button
                onClick={markPresent}
                disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all disabled:opacity-60 shadow-lg shadow-green-200/50"
              >
                {loading ? "Memproses..." : "Konfirmasi Presensi"}
              </button>
            ) : (
              <button onClick={resetSearch} className="w-full py-3 bg-slate-100 text-slate-700 font-semibold rounded-xl hover:bg-slate-200 transition-all">
                Cari Lagi
              </button>
            )}
          </div>
        )}

        {step === "done" && (
          <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 p-8 text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Presensi Berhasil!</h2>
            <p className="text-slate-500 mb-2">{participant?.fullName} telah terverifikasi.</p>
            {similarityScore > 0 && (
              <div className="bg-green-50 rounded-xl p-3 mb-6 inline-block">
                <p className="text-sm text-green-700">
                  <span className="font-semibold">Cosine Similarity:</span> {(similarityScore * 100).toFixed(1)}%
                </p>
              </div>
            )}
            <button
              onClick={resetSearch}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg shadow-blue-200/50"
            >
              Presensi Lagi
            </button>
          </div>
        )}
      </main>
    </div>
  );
}