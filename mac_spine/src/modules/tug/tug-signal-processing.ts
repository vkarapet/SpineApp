import {
  TUG_STEP_MIN_INTERVAL_MS,
  TUG_STEP_PEAK_VALLEY_MAX_MS,
  TUG_STEP_INITIAL_THRESHOLD,
  TUG_WEINBERG_K,
  TUG_STEP_SMOOTH_WINDOW,
} from '../../constants';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface DecomposedAccel {
  vertical: number;
  horizontal: number;
  magnitude: number;
}

export interface DetectedStep {
  t: number;
  /** Peak of the detection signal (user-accel magnitude) — used for threshold derivation. */
  peakAccel: number;
  /** Valley of the detection signal (user-accel magnitude). */
  valleyAccel: number;
  /** Weinberg stride length, computed from the vertical-bounce peak/valley in this interval. */
  strideLength: number;
}

// --- Vector math ---

export function magnitude(v: Vec3): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

export function normalize(v: Vec3): Vec3 {
  const mag = magnitude(v);
  if (mag < 1e-9) return { x: 0, y: 0, z: 0 };
  return { x: v.x / mag, y: v.y / mag, z: v.z / mag };
}

export function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

// --- Filters ---

export function lowPassFilter(current: Vec3, previous: Vec3, alpha: number): Vec3 {
  return {
    x: alpha * current.x + (1 - alpha) * previous.x,
    y: alpha * current.y + (1 - alpha) * previous.y,
    z: alpha * current.z + (1 - alpha) * previous.z,
  };
}

// --- Acceleration decomposition ---

export function decomposeAcceleration(accelRaw: Vec3, gravity: Vec3): DecomposedAccel {
  const gravNorm = normalize(gravity);

  // User acceleration = raw - gravity
  const userAccel: Vec3 = {
    x: accelRaw.x - gravity.x,
    y: accelRaw.y - gravity.y,
    z: accelRaw.z - gravity.z,
  };

  // Vertical component = projection onto gravity axis
  const vertical = dot(userAccel, gravNorm);

  // Horizontal component = magnitude of residual
  const verticalVec: Vec3 = {
    x: vertical * gravNorm.x,
    y: vertical * gravNorm.y,
    z: vertical * gravNorm.z,
  };
  const horizontalVec: Vec3 = {
    x: userAccel.x - verticalVec.x,
    y: userAccel.y - verticalVec.y,
    z: userAccel.z - verticalVec.z,
  };
  const horizontal = magnitude(horizontalVec);

  return {
    vertical,
    horizontal,
    magnitude: magnitude(userAccel),
  };
}

// --- Weinberg stride length ---

export function weinbergStride(aMax: number, aMin: number, K: number = TUG_WEINBERG_K): number {
  const diff = aMax - aMin;
  if (diff <= 0) return 0;
  return K * Math.pow(diff, 0.25);
}

// --- Step Detector ---

export interface StepDetectorConfig {
  initialThreshold: number;
  minIntervalMs: number;
  peakValleyMaxMs: number;
}

/**
 * Two-signal step detector.
 *
 * Detection signal: total user-acceleration magnitude (||raw - gravity||).
 *   Robust to phone orientation; captures arm-swing energy when phone is
 *   hand-held, hip-bounce energy when phone is in pocket. Used for finding
 *   step timing and computing the peak-valley threshold.
 *
 * Stride signal: vertical user-acceleration (signed projection onto gravity).
 *   Tracked in parallel for the Weinberg stride-length estimator, which was
 *   derived against vertical bounce specifically.
 *
 * The detector's state machine runs on the smoothed detection signal. The
 * stride signal's min/max are accumulated independently between confirmed
 * steps; on confirmation, they yield the Weinberg stride length.
 */
export class StepDetector {
  private cfg: StepDetectorConfig;

  private smoothBuffer: number[] = [];
  private smoothSum = 0;

  private lastSmoothedValue = 0;
  private rising = false;

  private currentPeak = -Infinity;
  private currentPeakT = 0;
  private currentValley = Infinity;

  // Stride-signal accumulators (independent of state machine).
  private strideMin = Infinity;
  private strideMax = -Infinity;

  private lastStepT = -Infinity;
  private stepCount = 0;
  private threshold: number;

  constructor(config?: Partial<StepDetectorConfig>) {
    this.cfg = {
      initialThreshold: config?.initialThreshold ?? TUG_STEP_INITIAL_THRESHOLD,
      minIntervalMs: config?.minIntervalMs ?? TUG_STEP_MIN_INTERVAL_MS,
      peakValleyMaxMs: config?.peakValleyMaxMs ?? TUG_STEP_PEAK_VALLEY_MAX_MS,
    };
    this.threshold = this.cfg.initialThreshold;
  }

  processSample(t: number, detectionSignal: number, strideSignal: number): DetectedStep | null {
    // Track stride signal min/max for Weinberg stride length, regardless of
    // detection state. Reset at every confirmed step.
    if (strideSignal < this.strideMin) this.strideMin = strideSignal;
    if (strideSignal > this.strideMax) this.strideMax = strideSignal;

    // Smooth the detection signal.
    this.smoothBuffer.push(detectionSignal);
    this.smoothSum += detectionSignal;
    if (this.smoothBuffer.length > TUG_STEP_SMOOTH_WINDOW) {
      this.smoothSum -= this.smoothBuffer.shift()!;
    }
    const smoothed = this.smoothSum / this.smoothBuffer.length;

    const derivative = smoothed - this.lastSmoothedValue;
    this.lastSmoothedValue = smoothed;

    if (derivative > 0) {
      // Rising
      if (!this.rising) {
        // Was falling, now rising → valley detected
        this.currentValley = smoothed;
      }
      this.rising = true;
      if (smoothed > this.currentPeak) {
        this.currentPeak = smoothed;
        this.currentPeakT = t;
      }
    } else if (derivative < 0) {
      // Falling
      if (this.rising && this.currentPeak > -Infinity) {
        const peakValleyDiff = this.currentPeak - this.currentValley;
        const timeSinceLastStep = t - this.lastStepT;
        const peakToNowInterval = t - this.currentPeakT;

        if (
          peakValleyDiff > this.threshold &&
          timeSinceLastStep >= this.cfg.minIntervalMs &&
          peakToNowInterval <= this.cfg.peakValleyMaxMs
        ) {
          this.stepCount++;
          this.lastStepT = t;

          // Stride from vertical bounce accumulated this interval (Weinberg).
          const stride = this.strideMax > -Infinity && this.strideMin < Infinity
            ? weinbergStride(this.strideMax, this.strideMin)
            : 0;

          const step: DetectedStep = {
            t,
            peakAccel: this.currentPeak,
            valleyAccel: this.currentValley,
            strideLength: stride,
          };

          // Reset for next step on both tracks.
          this.currentPeak = smoothed;
          this.currentPeakT = t;
          this.currentValley = smoothed;
          this.strideMin = strideSignal;
          this.strideMax = strideSignal;

          return step;
        }
      }
      this.rising = false;
      if (smoothed < this.currentValley) {
        this.currentValley = smoothed;
      }
    }

    return null;
  }

  getStepCount(): number {
    return this.stepCount;
  }

  reset(): void {
    this.smoothBuffer = [];
    this.smoothSum = 0;
    this.lastSmoothedValue = 0;
    this.rising = false;
    this.currentPeak = -Infinity;
    this.currentPeakT = 0;
    this.currentValley = Infinity;
    this.strideMin = Infinity;
    this.strideMax = -Infinity;
    this.lastStepT = -Infinity;
    this.stepCount = 0;
    this.threshold = this.cfg.initialThreshold;
  }
}
