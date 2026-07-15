/**
 * Fix: Video ref timing bug in register/page.tsx
 *
 * Changes:
 * 1. In startCamera(): move videoRef null check AFTER setCameraActive(true)
 *    so React has time to render the video element
 * 2. Change Camera View from conditional rendering {cameraActive && (...)}
 *    to always-rendered with hidden CSS class (like presensi page)
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const filePath = join(__dirname, "..", "src", "app", "register", "page.tsx");
let content = readFileSync(filePath, "utf-8");

// Fix 1: In startCamera(), remove null check before setCameraActive
// Old (before setCameraActive):
//   const startCamera = async () => {
//     if (!videoRef.current) {
//       setError("Video element tidak ditemukan");
//       return;
//     }
//     if (!isMountedRef.current) return;
// New (after setCameraActive, keep the null check but check the ref after state update):
// Actually since we'll make video always rendered, the ref is always valid.
// So keep the check at the top - it will now work because video is always in DOM.

// Fix 2: Change Camera View conditional rendering to hidden class
const oldCameraSection = `                    {/* Camera View */}
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
                          <div className={\`w-44 h-52 border-2 rounded-2xl transition-all duration-300 $\{
                            faceReady ? "border-green-400 bg-green-500/10" : "border-blue-400 bg-blue-500/5"
                          }\`}>
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-40 border-2 rounded-full border-dashed opacity-40"></div>
                          </div>
                        </div>
                        {/* Status */}
                        <div className="absolute top-3 left-3">
                          <div className={\`px-3 py-1.5 rounded-lg text-xs font-medium backdrop-blur-sm $\{
                            faceReady
                              ? "bg-green-500/80 text-white"
                              : faceStatus.includes("tidak")
                              ? "bg-red-500/80 text-white"
                              : "bg-blue-500/80 text-white"
                          }\`}>
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
                    )}`;

const newCameraSection = `                    {/* Camera View - always rendered but hidden when not active */}
                    <div className={\`relative aspect-[4/3] bg-black rounded-xl overflow-hidden mb-4 $\{cameraActive ? "" : "hidden"\}\`}>
                      <video
                        ref={videoRef}
                        className="w-full h-full object-cover"
                        autoPlay
                        playsInline
                        muted
                      />
                      {/* Face guide overlay */}
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className={\`w-44 h-52 border-2 rounded-2xl transition-all duration-300 $\{
                          faceReady ? "border-green-400 bg-green-500/10" : "border-blue-400 bg-blue-500/5"
                        }\`}>
                          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-40 border-2 rounded-full border-dashed opacity-40"></div>
                        </div>
                      </div>
                      {/* Status */}
                      <div className="absolute top-3 left-3">
                        <div className={\`px-3 py-1.5 rounded-lg text-xs font-medium backdrop-blur-sm $\{
                          faceReady
                            ? "bg-green-500/80 text-white"
                            : faceStatus.includes("tidak")
                            ? "bg-red-500/80 text-white"
                            : "bg-blue-500/80 text-white"
                        }\`}>
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
                    </div>`;

if (content.includes(oldCameraSection)) {
  content = content.replace(oldCameraSection, newCameraSection);
  console.log("✅ Camera View section updated (conditional → hidden class)");
} else {
  console.log("⚠️  Camera View old section not found! Checking for alternative pattern...");
  // Try to find the pattern
  if (content.includes('{cameraActive && (')) {
    console.log("  Found {cameraActive && ( pattern");
  }
}

writeFileSync(filePath, content, "utf-8");
console.log("✅ File written successfully");
