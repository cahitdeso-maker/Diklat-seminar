/**
 * FaceCamera - Manages webcam access and video stream lifecycle.
 *
 * Features:
 * - Waits for camera readiness (loadedmetadata, loadeddata, canplay, playing)
 * - Provides isReady() check before detection
 * - Proper cleanup on stop()
 * - Comprehensive debug logging for camera initialization
 */

// Force debug logging on for camera debugging
const DEBUG = true;

function log(...args: unknown[]): void {
  if (DEBUG) {
    console.log("[FaceCamera]", ...args);
  }
}

function warn(...args: unknown[]): void {
  if (DEBUG) {
    console.warn("[FaceCamera]", ...args);
  }
}

function error(...args: unknown[]): void {
  if (DEBUG) {
    console.error("[FaceCamera]", ...args);
  }
}

export class FaceCamera {
  private stream: MediaStream | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private _isReady = false;

  /**
   * Start the camera and attach to a video element.
   * Waits for the video to be fully ready before resolving.
   * Logs every step for debugging.
   */
  async start(videoElement: HTMLVideoElement): Promise<void> {
    this.videoElement = videoElement;
    this._isReady = false;

    log("=== Camera Start ===");
    log("video element:", videoElement);

    // Step 1: Check navigator.mediaDevices
    log("Step 1: Checking navigator.mediaDevices...");
    if (!navigator.mediaDevices) {
      error("navigator.mediaDevices is undefined!");
      throw new Error("navigator.mediaDevices tidak tersedia. Pastikan koneksi HTTPS atau localhost.");
    }
    log("navigator.mediaDevices exists:", !!navigator.mediaDevices);
    log("navigator.mediaDevices.getUserMedia exists:", typeof navigator.mediaDevices.getUserMedia);

    // Step 2: Request camera permission and get stream
    log("Step 2: Requesting camera permission via getUserMedia...");
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });
      log("getUserMedia SUCCESS. Stream tracks:", this.stream.getVideoTracks().length);
      this.stream.getVideoTracks().forEach((track, i) => {
        log(`  Track ${i}:`, {
          label: track.label,
          kind: track.kind,
          enabled: track.enabled,
          muted: track.muted,
          readyState: track.readyState,
          settings: track.getSettings(),
        });
      });
    } catch (err: any) {
      error("getUserMedia FAILED:", err);
      error("Error name:", err.name);
      error("Error message:", err.message);
      if (err.name === "NotAllowedError") {
        throw new Error("Izin kamera ditolak. Silakan berikan izin kamera di pengaturan browser.");
      } else if (err.name === "NotFoundError") {
        throw new Error("Kamera tidak ditemukan. Pastikan kamera terhubung.");
      } else if (err.name === "NotReadableError") {
        throw new Error("Kamera sedang digunakan oleh aplikasi lain.");
      } else {
        throw new Error(`Gagal mengakses kamera: ${err.message}`);
      }
    }

    // Step 3: Attach stream to video element
    log("Step 3: Attaching stream to video element...");
    videoElement.srcObject = this.stream;
    log("video.srcObject assigned:", videoElement.srcObject !== null);

    // Verify srcObject was set correctly
    if (!videoElement.srcObject) {
      error("video.srcObject is null after assignment!");
      this.stop();
      throw new Error("Gagal menempelkan stream ke video element.");
    }
    log("video.srcObject is correctly assigned.");

    // Step 4: Wait for camera to be fully ready
    log("Step 4: Waiting for camera readiness...");
    try {
      await this.waitForReady(videoElement);
      log("waitForReady resolved successfully.");
    } catch (err: any) {
      error("waitForReady FAILED:", err);
      this.stop();
      throw new Error(`Kamera gagal siap: ${err.message}`);
    }

    // Step 5: Final verification
    log("Step 5: Final camera verification...");
    log("video.readyState:", videoElement.readyState);
    log("video.videoWidth:", videoElement.videoWidth);
    log("video.videoHeight:", videoElement.videoHeight);
    log("video.paused:", videoElement.paused);
    log("video.ended:", videoElement.ended);
    log("video.seeking:", videoElement.seeking);

    if (videoElement.videoWidth === 0 || videoElement.videoHeight === 0) {
      error("Video dimensions are 0 after waitForReady resolved!");
      this.stop();
      throw new Error("Kamera tidak mengirimkan video (dimensi 0).");
    }

    this._isReady = true;
    log("=== Camera Start Complete ===");
    log("Camera is ready. Resolution:", `${videoElement.videoWidth}x${videoElement.videoHeight}`);
  }

  /**
   * Wait for the video element to be fully ready for capture.
   * Waits for: loadedmetadata, loadeddata, canplay, playing events.
   * Logs every event for debugging.
   */
  private waitForReady(video: HTMLVideoElement): Promise<void> {
    return new Promise((resolve, reject) => {
      log("waitForReady: Starting...");
      log("waitForReady: Initial readyState:", video.readyState);
      log("waitForReady: Initial videoWidth:", video.videoWidth);
      log("waitForReady: Initial videoHeight:", video.videoHeight);

      // If already ready, resolve immediately
      if (
        video.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA &&
        video.videoWidth > 0 &&
        video.videoHeight > 0
      ) {
        log("waitForReady: Already ready, resolving immediately.");
        resolve();
        return;
      }

      log("waitForReady: Not ready yet, setting up event listeners...");

      const timeout = setTimeout(() => {
        log("waitForReady: TIMEOUT reached (10s)");
        log("waitForReady: Timeout readyState:", video.readyState);
        log("waitForReady: Timeout videoWidth:", video.videoWidth);
        log("waitForReady: Timeout videoHeight:", video.videoHeight);
        cleanup();
        // If timeout, check if we have enough data anyway
        if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
          log("waitForReady: Resolving after timeout (partial data available).");
          resolve();
        } else {
          error("waitForReady: Rejecting after timeout - no data available.");
          reject(new Error("Timeout menunggu kamera"));
        }
      }, 10000);

      const onLoadedMetadata = () => {
        log("waitForReady: EVENT loadedmetadata fired", {
          videoWidth: video.videoWidth,
          videoHeight: video.videoHeight,
          readyState: video.readyState,
          readyStateName: getReadyStateName(video.readyState),
        });
        checkReady();
      };

      const onLoadedData = () => {
        log("waitForReady: EVENT loadeddata fired", {
          videoWidth: video.videoWidth,
          videoHeight: video.videoHeight,
          readyState: video.readyState,
          readyStateName: getReadyStateName(video.readyState),
        });
        checkReady();
      };

      const onCanPlay = () => {
        log("waitForReady: EVENT canplay fired", {
          videoWidth: video.videoWidth,
          videoHeight: video.videoHeight,
          readyState: video.readyState,
          readyStateName: getReadyStateName(video.readyState),
        });
        checkReady();
      };

      const onPlaying = () => {
        log("waitForReady: EVENT playing fired", {
          videoWidth: video.videoWidth,
          videoHeight: video.videoHeight,
          readyState: video.readyState,
          readyStateName: getReadyStateName(video.readyState),
        });
        checkReady();
      };

      const checkReady = () => {
        const isReady =
          video.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA &&
          video.videoWidth > 0 &&
          video.videoHeight > 0;
        log("waitForReady: checkReady()", {
          isReady,
          readyState: video.readyState,
          readyStateName: getReadyStateName(video.readyState),
          videoWidth: video.videoWidth,
          videoHeight: video.videoHeight,
        });
        if (isReady) {
          cleanup();
          log("waitForReady: Camera is ready! Resolving.");
          resolve();
        }
      };

      const cleanup = () => {
        clearTimeout(timeout);
        video.removeEventListener("loadedmetadata", onLoadedMetadata);
        video.removeEventListener("loadeddata", onLoadedData);
        video.removeEventListener("canplay", onCanPlay);
        video.removeEventListener("playing", onPlaying);
        log("waitForReady: Cleanup complete (listeners removed, timeout cleared).");
      };

      video.addEventListener("loadedmetadata", onLoadedMetadata);
      video.addEventListener("loadeddata", onLoadedData);
      video.addEventListener("canplay", onCanPlay);
      video.addEventListener("playing", onPlaying);
      log("waitForReady: Event listeners attached.");

      // Start playing
      log("waitForReady: Calling video.play()...");
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            log("waitForReady: video.play() resolved successfully.");
          })
          .catch((err: any) => {
            error("waitForReady: video.play() rejected:", err);
            error("waitForReady: Play error name:", err.name);
            error("waitForReady: Play error message:", err.message);
            cleanup();
            reject(new Error(`Gagal memutar video: ${err.message}`));
          });
      } else {
        log("waitForReady: video.play() returned undefined (older browser).");
      }
    });
  }

  /**
   * Check if camera is ready for frame capture.
   */
  isReady(): boolean {
    if (!this.videoElement || !this.stream) {
      log("isReady: false - no video element or stream");
      return false;
    }
    const ready =
      this._isReady &&
      this.videoElement.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA &&
      this.videoElement.videoWidth > 0 &&
      this.videoElement.videoHeight > 0;
    if (!ready) {
      log("isReady: false", {
        _isReady: this._isReady,
        readyState: this.videoElement.readyState,
        videoWidth: this.videoElement.videoWidth,
        videoHeight: this.videoElement.videoHeight,
      });
    }
    return ready;
  }

  /**
   * Stop the camera and release resources.
   */
  stop(): void {
    log("stop: Stopping camera...");
    this._isReady = false;
    if (this.stream) {
      const tracks = this.stream.getVideoTracks();
      log("stop: Stopping", tracks.length, "video track(s)");
      this.stream.getTracks().forEach((track) => {
        log("stop: Stopping track:", track.label);
        track.stop();
      });
      this.stream = null;
    }
    if (this.videoElement) {
      log("stop: Clearing video.srcObject");
      this.videoElement.srcObject = null;
      this.videoElement = null;
    }
    log("stop: Camera stopped.");
  }

  /**
   * Capture a single frame from the video as a base64 JPEG.
   */
  captureFrame(canvas: HTMLCanvasElement, quality = 0.85): string {
    if (!this.videoElement) throw new Error("Kamera tidak aktif");
    if (!this.isReady()) throw new Error("Kamera belum siap");

    const video = this.videoElement;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Gagal menginisialisasi canvas");

    ctx.drawImage(video, 0, 0);
    return canvas.toDataURL("image/jpeg", quality);
  }

  /**
   * Check if camera is currently active.
   */
  get isActive(): boolean {
    return this.stream !== null && this.videoElement !== null;
  }
}

/**
 * Get human-readable name for HTMLMediaElement readyState.
 */
function getReadyStateName(state: number): string {
  switch (state) {
    case HTMLMediaElement.HAVE_NOTHING: return "HAVE_NOTHING (0)";
    case HTMLMediaElement.HAVE_METADATA: return "HAVE_METADATA (1)";
    case HTMLMediaElement.HAVE_CURRENT_DATA: return "HAVE_CURRENT_DATA (2)";
    case HTMLMediaElement.HAVE_FUTURE_DATA: return "HAVE_FUTURE_DATA (3)";
    case HTMLMediaElement.HAVE_ENOUGH_DATA: return "HAVE_ENOUGH_DATA (4)";
    default: return `UNKNOWN (${state})`;
  }
}