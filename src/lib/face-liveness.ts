/**
 * FaceLivenessService - Anti-spoofing liveness detection.
 *
 * Verifies the user is a real person (not a photo) by checking:
 * - Blink detection (eyes open/close)
 * - Head movement (slight turn left/right)
 *
 * All landmark index accesses are bounds-checked to prevent runtime errors.
 */
export class FaceLivenessService {
  private blinkState = { left: true, right: true };
  private blinkCount = 0;
  private requiredBlinks = 1;
  private headTurnState = { left: false, right: false };
  private headTurnCount = 0;
  private requiredHeadTurns = 0;
  private previousNoseX = 0;
  private previousNoseY = 0;
  private movementThreshold = 0.02;

  /**
   * Reset liveness state for a new verification session.
   */
  reset(): void {
    this.blinkState = { left: true, right: true };
    this.blinkCount = 0;
    this.headTurnState = { left: false, right: false };
    this.headTurnCount = 0;
    this.previousNoseX = 0;
    this.previousNoseY = 0;
  }

  /**
   * Safely get a landmark value by index, with bounds checking.
   */
  private getLandmark(landmarks: Float32Array, index: number, component: 0 | 1 | 2): number {
    const pos = index * 3 + component;
    if (pos < 0 || pos >= landmarks.length) return 0;
    return landmarks[pos];
  }

  /**
   * Check liveness from face landmarks.
   * Returns liveness status and guidance messages.
   * Safe to call with any landmark array - bounds-checked internally.
   */
  checkLiveness(landmarks: Float32Array): {
    passed: boolean;
    progress: number;
    message: string;
    blinkDetected: boolean;
    headMovementDetected: boolean;
  } {
    const len = landmarks.length / 3;

    // If not enough landmarks, return safe default
    if (len < 400) {
      return {
        passed: false,
        progress: 0,
        message: "Wajah tidak terdeteksi dengan baik",
        blinkDetected: false,
        headMovementDetected: false,
      };
    }

    // Extract key landmarks with bounds checking
    const leftEyeTop = this.getLandmark(landmarks, 159, 1);
    const leftEyeBottom = this.getLandmark(landmarks, 145, 1);
    const rightEyeTop = this.getLandmark(landmarks, 386, 1);
    const rightEyeBottom = this.getLandmark(landmarks, 374, 1);
    const noseTipX = this.getLandmark(landmarks, 1, 0);
    const noseTipY = this.getLandmark(landmarks, 1, 1);

    // Check blink
    const leftEyeOpen = Math.abs(leftEyeTop - leftEyeBottom) > 0.015;
    const rightEyeOpen = Math.abs(rightEyeTop - rightEyeBottom) > 0.015;

    let blinkDetected = false;
    if (!leftEyeOpen && !rightEyeOpen && this.blinkState.left && this.blinkState.right) {
      this.blinkCount++;
      blinkDetected = true;
    }
    this.blinkState = { left: leftEyeOpen, right: rightEyeOpen };

    // Check head movement
    let headMovementDetected = false;
    if (this.previousNoseX !== 0) {
      const dx = Math.abs(noseTipX - this.previousNoseX);
      const dy = Math.abs(noseTipY - this.previousNoseY);
      if (dx > this.movementThreshold || dy > this.movementThreshold) {
        headMovementDetected = true;
        this.headTurnCount++;
      }
    }
    this.previousNoseX = noseTipX;
    this.previousNoseY = noseTipY;

    // Calculate progress
    const blinkProgress = Math.min(this.blinkCount / Math.max(this.requiredBlinks, 1), 1);
    const headTurnProgress = this.requiredHeadTurns > 0
      ? Math.min(this.headTurnCount / this.requiredHeadTurns, 1)
      : 1;
    const progress = Math.round(((blinkProgress + headTurnProgress) / 2) * 100);

    // Determine message
    let message = "Arahkan wajah ke kamera";
    if (this.blinkCount < this.requiredBlinks) {
      message = "Kedipkan mata Anda";
    } else if (this.requiredHeadTurns > 0 && this.headTurnCount < this.requiredHeadTurns) {
      message = "Gerakkan kepala sedikit ke kanan/kiri";
    } else {
      message = "Verifikasi selesai";
    }

    const passed = this.blinkCount >= this.requiredBlinks &&
      this.headTurnCount >= this.requiredHeadTurns;

    return {
      passed,
      progress,
      message,
      blinkDetected,
      headMovementDetected,
    };
  }

  /**
   * Check if the face is likely a photo (no movement, no blink).
   * Bounds-checked to prevent runtime errors.
   */
  isLikelyPhoto(landmarks: Float32Array, previousLandmarks: Float32Array | null): boolean {
    if (!previousLandmarks) return false;

    let totalMovement = 0;
    const len = Math.min(landmarks.length, previousLandmarks.length);

    for (let i = 0; i < len; i++) {
      totalMovement += Math.abs(landmarks[i] - previousLandmarks[i]);
    }

    const avgMovement = totalMovement / Math.max(len, 1);
    return avgMovement < 0.0001; // Almost no movement = likely a photo
  }
}