"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import QRCode from "react-qr-code";
import { FaceCamera } from "@/lib/face-camera";
import { detectFaces, cropFace, loadFaceLandmarkerModel } from "@/services/FaceDetectionService";
import { validateFaceQuality, analyzeImageQuality } from "@/services/FaceQualityService";
import { generateEmbedding } from "@/services/FaceRecognitionService";
import { EmbeddingService } from "@/services/EmbeddingService";
import { FaceLivenessService } from "@/lib/face-liveness";

interface Seminar {
  id: string;
  title: string;
  description: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  maxParticipants: number;
}

interface FormData {
  seminarId: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  institution: string;
  profession: string;
}

function debugLog(...args: unknown[]): void {
  if (process.env.NODE_ENV === "development") {
    console.log("[RegisterPage]", ...args);
  }
}

export default function PublicRegisterPage() {
  const [step, setStep] = useState<"select" | "form" | "success">("select");
  const [seminars, setSeminars] = useState<Seminar[]>([]);
  const [selectedSeminar, setSelectedSeminar] = useState<Seminar | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState<FormData>({
    seminarId: "",
    fullName: "",
    email: "",
    phoneNumber: "",
    institution: "",
    profession: "",
  });
  const [registrationResult, setRegistrationResult] = useState<any>(null);
  const [faceData, setFaceData] = useState<string | null>(null);
  const [faceEmbedding, setFaceEmbedding] = useState<number[] | null>(null);
  const [faceQuality, setFaceQuality] = useState<number>(0);
  const [cameraActive, setCameraActive] = useState(false);
  const [faceStatus, setFaceStatus] = useState<string>("");
  const [faceReady, setFaceReady] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [modelError, setModelError] = useState("");

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const faceCameraRef = useRef<FaceCamera | null>(null);
  const livenessRef = useRef<FaceLivenessService | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const isDetectingRef = useRef(false);
  const previousLandmarksRef = useRef<Float32Array | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    fetchSeminars();
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
        setModelError(err.message || "Gagal memuat model");
        setModelsLoading(false);
      }
    }
  };

  const fetchSeminars = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/public/seminars");
      if (res.ok) {
        const data = await res.json();
        setSeminars(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error("Failed to fetch seminars", e);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const handleSelectSeminar = (seminar: Seminar) => {
    setSelectedSeminar(seminar);
    setFormData({ ...formData, seminarId: seminar.id });
    setStep("form");
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

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
    setCameraActive(false);
    setFaceReady(false);
  }, [cleanupDetection]);

  // Camera functions
  const startCamera = async () => {
    if (!videoRef.current) {
      setError("Video element tidak ditemukan");
      return;
    }
    if (!isMountedRef.current) return;

    setCameraActive(true);
    setFaceStatus("Mengakses kamera...");
    setFaceReady(false);
    setFaceData(null);
    setFaceEmbedding(null);
    setError("");

    debugLog("starting camera");

    try {
      const camera = new FaceCamera();
      faceCameraRef.current = camera;
      livenessRef.current = new FaceLivenessService();

      // Wait for camera to be fully ready
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
        setCameraActive(false);
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

        // Update status based on quality and liveness
        if (quality.score >= 70 && liveness.passed) {
          setFaceStatus("Wajah siap direkam ✓");
          setFaceReady(true);
          setFaceQuality(quality.score);
        } else if (quality.score < 70) {
          setFaceStatus(quality.messages[0] || "Posisikan wajah dengan benar");
          setFaceReady(false);
        } else {
          setFaceStatus(liveness.message);
          setFaceReady(false);
        }
      }
    } catch (err) {
      console.error("[RegisterPage] detection loop error:", err);
    }

    isDetectingRef.current = false;

    // Schedule next frame
    if (isMountedRef.current) {
      animationFrameRef.current = requestAnimationFrame(detectionLoop);
    }
  };

  const captureFace = async () => {
    const camera = faceCameraRef.current;
    const video = videoRef.current;
    if (!camera || !canvasRef.current || !video) return;
    if (!camera.isReady()) {
      setError("Kamera belum siap. Silakan coba lagi.");
      return;
    }

    setProcessing(true);
    setFaceStatus("Memproses embedding wajah...");
    debugLog("capturing face");

    try {
      // Capture frame for display
      const dataUrl = camera.captureFrame(canvasRef.current);

      // Analyze image quality
      const quality = await analyzeImageQuality(dataUrl);
      if (quality.isBlurry) {
        setError("Wajah terlalu blur. Silakan ambil ulang.");
        setProcessing(false);
        return;
      }
      if (quality.isTooDark) {
        setError("Pencahayaan terlalu gelap. Silakan cari tempat yang lebih terang.");
        setProcessing(false);
        return;
      }

      // Get face detection for cropping
      const timestamp = performance.now();
      const detectionResult = await detectFaces(video, timestamp);

      if (!detectionResult.detected || !detectionResult.faceRect) {
        setError("Wajah tidak terdeteksi saat pengambilan foto");
        setProcessing(false);
        return;
      }

      // Crop face from video frame using bounding box
      setFaceStatus("Mengambil gambar wajah...");
      const croppedFace = cropFace(video, detectionResult.faceRect);
      debugLog("face cropped for recognition", {
        width: croppedFace.width,
        height: croppedFace.height,
      });

      if (croppedFace.width === 0 || croppedFace.height === 0) {
        setError("Gagal mengambil gambar wajah. Silakan coba lagi.");
        setProcessing(false);
        return;
      }

      // Generate embedding from cropped face image (ONNX model)
      setFaceStatus("Menghasilkan embedding wajah...");
      const recognitionResult = await generateEmbedding(croppedFace);

      if (!recognitionResult.success || recognitionResult.embedding.length === 0) {
        setError("Gagal menghasilkan embedding wajah. Silakan coba lagi.");
        setProcessing(false);
        return;
      }

      debugLog("embedding generated", {
        dim: recognitionResult.embedding.length,
        method: recognitionResult.method,
        time: `${recognitionResult.inferenceTime}ms`,
      });

      // Normalize embedding
      const normalizedEmbedding = EmbeddingService.normalize(recognitionResult.embedding);

      setFaceData(dataUrl);
      setFaceEmbedding(normalizedEmbedding);
      setFaceQuality(quality.sharpness);
      stopCamera();

      // Auto-submit registration when face is detected and saved
      setFaceStatus("Wajah tersimpan! Mengirim data ke server...");
      await submitRegistration(dataUrl, normalizedEmbedding, quality.sharpness);
    } catch (err: any) {
      debugLog("capture face error:", err);
      setError(err.message || "Gagal memproses wajah");
    } finally {
      setProcessing(false);
    }
  };

  const retakeFace = () => {
    setFaceData(null);
    setFaceEmbedding(null);
    setFaceQuality(0);
    setError("");
    startCamera();
  };

  const submitRegistration = async (faceDataOverride?: string, faceEmbeddingOverride?: number[], faceQualityOverride?: number) => {
    setError("");
    setSubmitting(true);

    try {
      const res = await fetch("/api/registrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          faceData: faceDataOverride !== undefined ? faceDataOverride : faceData,
          faceEmbedding: faceEmbeddingOverride !== undefined ? faceEmbeddingOverride : faceEmbedding,
          faceQuality: faceQualityOverride !== undefined ? faceQualityOverride : faceQuality,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setRegistrationResult(data.registration);
        setStep("success");
      } else {
        setError(data.error || "Gagal mendaftar. Silakan coba lagi.");
      }
    } catch {
      setError("Terjadi kesalahan. Silakan coba lagi.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const res = await fetch("/api/registrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setRegistrationResult(data.registration);
        setStep("success");
      } else {
        setError(data.error || "Gagal mendaftar. Silakan coba lagi.");
      }
    } catch {
      setError("Terjadi kesalahan. Silakan coba lagi.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setStep("select");
    setSelectedSeminar(null);
    setFormData({
      seminarId: "",
      fullName: "",
      email: "",
      phoneNumber: "",
      institution: "",
      profession: "",
    });
    setError("");
    setRegistrationResult(null);
  };

  // Loading state
  if (loading && step === "select") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-14 h-14 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-slate-500 font-medium">Memuat data seminar...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* Simple Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-100 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200/40">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-800">Daftar Seminar</h1>
                <p className="text-[10px] text-slate-400">Diklat RS PKU Muhammadiyah Gombong</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline text-xs text-slate-400">Pendaftaran Peserta</span>
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Error */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-5 py-4 rounded-xl text-sm flex items-center gap-2">
            <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            {error}
          </div>
        )}

        {/* Step Indicators */}
        <div className="mb-8">
          <div className="flex items-center justify-center gap-2 sm:gap-4">
            {[
              { key: "select", label: "Pilih Seminar" },
              { key: "form", label: "Data Diri" },
              { key: "success", label: "Selesai" },
            ].map((s, i) => {
              const isActive = getStepIndex(s.key) <= getStepIndex(step);
              const isCurrent = s.key === step;
              return (
                <div key={s.key} className="flex items-center gap-2 sm:gap-4">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold transition-all duration-300 ${
                        isCurrent
                          ? "bg-blue-600 text-white shadow-lg shadow-blue-200 scale-110"
                          : isActive
                          ? "bg-blue-100 text-blue-600"
                          : "bg-slate-100 text-slate-400"
                      }`}
                    >
                      {isActive && s.key !== step ? (
                        <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        i + 1
                      )}
                    </div>
                    <span
                      className={`hidden sm:block text-xs font-medium ${
                        isCurrent ? "text-blue-600" : isActive ? "text-slate-600" : "text-slate-400"
                      }`}
                    >
                      {s.label}
                    </span>
                  </div>
                  {i < 2 && (
                    <div
                      className={`w-8 sm:w-12 h-0.5 rounded-full transition-all duration-500 ${
                        isActive ? "bg-blue-400" : "bg-slate-200"
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* STEP 1: Pilih Seminar */}
        {step === "select" && (
          <div className="animate-fadeIn">
            {/* Available Seminars Preview */}
            <div className="text-center mb-8">
              <h3 className="text-xl font-bold text-slate-800 mb-2">Seminar Tersedia</h3>
              <p className="text-slate-500 text-sm">
                {seminars.length > 0
                  ? `${seminars.length} seminar tersedia untuk didaftar`
                  : "Belum ada seminar yang tersedia saat ini"}
              </p>
            </div>

            {seminars.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 mb-8">
                {seminars.map((seminar) => (
                  <div
                    key={seminar.id}
                    className="bg-white rounded-2xl p-6 shadow-lg shadow-slate-200/50 border border-slate-100 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 cursor-pointer group"
                    onClick={() => handleSelectSeminar(seminar)}
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                        <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-slate-800 mb-1 truncate">{seminar.title}</h4>
                        <p className="text-xs text-slate-500 mb-2 line-clamp-2">{seminar.description || "Tidak ada deskripsi"}</p>
                        <div className="flex flex-wrap gap-2">
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-lg">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 002-2v12a2 2 0 002-2v12a2 2 0 002 2z" />
                            </svg>
                            {formatDate(seminar.date)}
                          </span>
                          {seminar.location && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-700 text-xs rounded-lg">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              {seminar.location}
                            </span>
                          )}
                        </div>
                      </div>
                      <svg className="w-5 h-5 text-slate-300 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-2xl p-10 shadow-lg shadow-slate-200/50 border border-slate-100 text-center mb-8">
                <div className="w-20 h-20 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-10 h-10 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <h4 className="text-lg font-semibold text-slate-600 mb-2">Belum Ada Seminar Tersedia</h4>
                <p className="text-slate-400 text-sm">Saat ini belum ada seminar atau pelatihan yang dapat didaftar.</p>
              </div>
            )}
          </div>
        )}

        {/* STEP 2: Form Data Diri */}
        {step === "form" && selectedSeminar && (
          <div className="animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-lg shadow-slate-200/50 border border-slate-100 overflow-hidden">
              {/* Selected Seminar Info */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-slate-100 p-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                    <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 font-medium">Seminar Dipilih</p>
                    <h3 className="font-semibold text-slate-800">{selectedSeminar.title}</h3>
                    <p className="text-xs text-slate-500">{formatDate(selectedSeminar.date)}{selectedSeminar.location ? ` - ${selectedSeminar.location}` : ""}</p>
                  </div>
                  <button
                    onClick={() => { setStep("select"); setSelectedSeminar(null); }}
                    className="ml-auto px-3 py-1.5 bg-white rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    Ganti
                  </button>
                </div>
              </div>

              {/* Form */}
              <div className="p-5 sm:p-8">
                <h3 className="text-lg font-bold text-slate-800 mb-1">Data Peserta</h3>
                <p className="text-sm text-slate-500 mb-6">Isi data diri Anda dengan lengkap dan benar</p>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="grid sm:grid-cols-2 gap-5">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Nama Lengkap <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                          <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>
                        <input
                          type="text"
                          name="fullName"
                          value={formData.fullName}
                          onChange={handleInputChange}
                          placeholder="Masukkan nama lengkap"
                          className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:border-blue-400 outline-none focus:ring-2 focus:ring-blue-50 transition-all"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Email
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                          <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2-2v10a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <input
                          type="email"
                          name="email"
                          value={formData.email}
                          onChange={handleInputChange}
                          placeholder="contoh@email.com"
                          className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:border-blue-400 outline-none focus:ring-2 focus:ring-blue-50 transition-all"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        No. WhatsApp
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                          <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                          </svg>
                        </div>
                        <input
                          type="tel"
                          name="phoneNumber"
                          value={formData.phoneNumber}
                          onChange={handleInputChange}
                          placeholder="08xxxxx"
                          className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:border-blue-400 outline-none focus:ring-2 focus:ring-blue-50 transition-all"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Institusi / Asal
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                          <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2-2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                        </div>
                        <input
                          type="text"
                          name="institution"
                          value={formData.institution}
                          onChange={handleInputChange}
                          placeholder="Nama instansi/rumah sakit"
                          className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:border-blue-400 outline-none focus:ring-2 focus:ring-blue-50 transition-all"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Profesi
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                          <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2-2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2-2v10a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <input
                          type="text"
                          name="profession"
                          value={formData.profession}
                          onChange={handleInputChange}
                          placeholder="Dokter, Perawat, dll"
                          className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:border-blue-400 outline-none focus:ring-2 focus:ring-blue-50 transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Face Registration Section */}
                  <div className="border-t border-slate-200 pt-5">
                    <h4 className="text-sm font-bold text-slate-700 mb-1">Foto Wajah (Opsional)</h4>
                    <p className="text-xs text-slate-400 mb-4">
                      Foto wajah digunakan untuk verifikasi presensi menggunakan Face ID
                    </p>

                    {modelError && (
                      <div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 rounded-xl text-xs mb-4">
                        {modelError}
                      </div>
                    )}

                    {modelsLoading && (
                      <div className="bg-blue-50 text-blue-600 p-3 rounded-xl text-sm mb-4 flex items-center gap-2">
                        <div className="animate-spin w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                        Memuat model Face Recognition...
                      </div>
                    )}

                    {/* Camera View */}
                    {cameraActive && (
                      <div className="relative aspect-[4/3] bg-black rounded-xl overflow-hidden mb-4">
                        <video
                          ref={videoRef}
                          className="w-full h-full object-cover"
                          autoPlay
                          playsInline
                          muted
                        />
                        {/* Face guide overlay */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className={`w-44 h-52 border-2 rounded-2xl transition-all duration-300 ${
                            faceReady ? "border-green-400 bg-green-500/10" : "border-blue-400 bg-blue-500/5"
                          }`}>
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-40 border-2 rounded-full border-dashed opacity-40"></div>
                          </div>
                        </div>
                        {/* Status */}
                        <div className="absolute top-3 left-3">
                          <div className={`px-3 py-1.5 rounded-lg text-xs font-medium backdrop-blur-sm ${
                            faceReady
                              ? "bg-green-500/80 text-white"
                              : faceStatus.includes("tidak")
                              ? "bg-red-500/80 text-white"
                              : "bg-blue-500/80 text-white"
                          }`}>
                            {faceStatus || "Memindai..."}
                          </div>
                        </div>
                        {/* Capture button */}
                        {faceReady && (
                          <button
                            type="button"
                            onClick={captureFace}
                            disabled={processing}
                            className="absolute bottom-4 left-1/2 -translate-x-1/2 px-6 py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 transition-colors shadow-lg animate-pulse disabled:opacity-60"
                          >
                            {processing ? "Memproses..." : "Ambil Foto"}
                          </button>
                        )}
                        {!faceReady && !processing && (
                          <button
                            type="button"
                            onClick={stopCamera}
                            className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors shadow-lg"
                          >
                            Batal
                          </button>
                        )}
                      </div>
                    )}

                    {/* Captured face preview */}
                    {faceData && !cameraActive && (
                      <div className="text-center mb-4">
                        <div className="relative w-32 h-32 mx-auto mb-3 rounded-full overflow-hidden border-4 border-green-400 shadow-lg">
                          <img src={faceData} alt="Foto wajah" className="w-full h-full object-cover" />
                          <div className="absolute top-2 right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        </div>
                        <p className="text-xs text-green-600 font-medium">Foto wajah tersimpan</p>
                        <button
                          type="button"
                          onClick={retakeFace}
                          className="mt-2 text-xs text-blue-600 hover:underline"
                        >
                          Ambil ulang
                        </button>
                      </div>
                    )}

                    {/* Start camera button */}
                    {!modelsLoading && !faceData && !cameraActive && (
                      <div className="text-center">
                        <button
                          type="button"
                          onClick={startCamera}
                          className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg shadow-blue-200/50 flex items-center gap-2 mx-auto"
                        >
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          Ambil Foto Wajah
                        </button>
                        <p className="text-xs text-slate-400 mt-2">
                          Gunakan kamera depan untuk hasil terbaik
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-3">
                    <svg className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-xs text-blue-700">
                      Data Anda akan digunakan untuk keperluan presensi dan penerbitan sertifikat.
                      Pastikan data yang diisi sesuai dengan identitas resmi.
                    </p>
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => { setStep("select"); setSelectedSeminar(null); }}
                      className="px-5 py-3 border border-slate-200 text-slate-700 font-medium rounded-xl text-sm hover:bg-slate-50 transition-all"
                    >
                      Kembali
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-60 shadow-lg shadow-blue-200/50 flex items-center justify-center gap-2"
                    >
                      {submitting ? (
                        <>
                          <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                          Mendaftarkan...
                        </>
                      ) : (
                        <>
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Daftar Sekarang
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: Success */}
        {step === "success" && registrationResult && (
          <div className="animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-lg shadow-slate-200/50 border border-slate-100 overflow-hidden">
              {/* Success Banner */}
              <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-8 text-center">
                <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-white mb-1">Pendaftaran Berhasil!</h2>
                <p className="text-emerald-100 text-sm">Selamat, Anda telah terdaftar sebagai peserta</p>
              </div>

              {/* Detail */}
              <div className="p-6 sm:p-8">
                <div className="text-center mb-6">
                  <div className="w-20 h-20 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg className="w-10 h-10 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-slate-800">{registrationResult.fullName}</h3>
                  <p className="text-slate-500 text-sm">{registrationResult.seminarTitle}</p>
                </div>

                <div className="bg-slate-50 rounded-xl p-5 space-y-3 mb-6">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-400">Seminar</span>
                    <span className="font-medium text-slate-700 text-right">{registrationResult.seminarTitle}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-400">Tanggal</span>
                    <span className="font-medium text-slate-700">{registrationResult.seminarDate ? formatDate(registrationResult.seminarDate) : "-"}</span>
                  </div>
                  {registrationResult.seminarLocation && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-400">Lokasi</span>
                      <span className="font-medium text-slate-700">{registrationResult.seminarLocation}</span>
                    </div>
                  )}
                  <div className="pt-3 border-t border-slate-200">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-400">Kode QR</span>
                      <span className="font-mono font-bold text-blue-600 text-xs bg-blue-50 px-3 py-1 rounded-lg">{registrationResult.qrCode}</span>
                    </div>
                  </div>
                </div>

                {/* QR Code Display */}
                {registrationResult.qrCode && (
                  <div className="text-center mb-6">
                    <div className="inline-block">
                      <QRCode
                        value={registrationResult.qrCode}
                        size={220}
                        level="Q"
                        className="mx-auto"
                      />
                    </div>
                    <p className="mt-2 text-sm text-slate-600">{registrationResult.qrCode}</p>
                    <div className="flex flex-col sm:flex-row gap-3 mt-4 justify-center">
                      <Link
                        href={`/print-registration/${registrationResult.id}?download=1`}
                        target="_blank"
                        className="w-full sm:w-auto px-5 py-3 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-blue-200/50"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                        </svg>
                        Download Kartu
                      </Link>
                    </div>
                  </div>
                )}

                <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex items-start gap-3 mb-6">
                  <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  <div className="text-xs text-amber-700">
                    <p className="font-medium mb-1">Simpan Kode QR Anda!</p>
                    <p>Kode QR di atas akan digunakan untuk presensi saat acara berlangsung. Silakan screenshot atau catat kode ini.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 mt-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <p className="text-center text-xs text-slate-400">
            &copy; {new Date().getFullYear()} Diklat RS PKU Muhammadiyah Gombong. Sistem Presensi Medis Pintar.
          </p>
        </div>
      </footer>

      {/* Animations */}
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.4s ease-out;
        }
      `}</style>
    </div>
  );
}

function getStepIndex(step: string): number {
  const steps = ["select", "form", "success"];
  return steps.indexOf(step);
}