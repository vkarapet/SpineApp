import {
  TUG_STEP_MIN_INTERVAL_MS,
  TUG_STEP_PEAK_VALLEY_MAX_MS,
  TUG_STEP_INITIAL_THRESHOLD,
  TUG_STEP_THRESHOLD_ADAPT_RATE,
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
  peakAccel: number;
  valleyAccel: number;
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

// --- Tilt ---

export function computeTilt(gravity: Vec3, restGravity: Vec3): number {
  const gNorm = normalize(gravity);
  const rNorm = normalize(restGravity);
  const d = Math.max(-1, Math.min(1, dot(gNorm, rNorm)));
  return Math.acos(d) * (180 / Math.PI);
}

// --- Yaw rate ---

export function computeYawRate(rotationRate: Vec3, gravity: Vec3): number {
  // Project rotation rate onto gravity axis to isolate yaw (vertical rotation)
  const gravNorm = normalize(gravity);
  return dot(rotationRate, gravNorm);
}

// --- Weinberg stride length ---

export function weinbergStride(aMax: number, aMin: number, K: number = TUG_WEINBERG_K): number {
  const diff = aMax - aMin;
  if (diff <= 0) return 0;
  return K * Math.pow(diff, 0.25);
}

// --- Sliding Window RMS ---

export class SlidingWindowRMS {
  private buffer: number[] = [];
  private sumSquares = 0;
  private windowSize: number;

  constructor(windowSizeSamples: number) {
    this.windowSize = windowSizeSamples;
  }

  update(value: number): number {
    this.buffer.push(value * value);
    this.sumSquares += value * value;
    if (this.buffer.length > this.windowSize) {
      this.sumSquares -= this.buffer.shift()!;
    }
    return Math.sqrt(this.sumSquares / this.buffer.length);
  }

  getRMS(): number {
    if (this.buffer.length === 0) return 0;
    return Math.sqrt(this.sumSquares / this.buffer.length);
  }

  reset(): void {
    this.buffer = [];
    this.sumSquares = 0;
  }
}

// --- Percentile utility ---

export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (idx - lower);
}

// --- Step Detector ---

export class StepDetector {
  private smoothBuffer: number[] = [];
  private smoothSum = 0;

  private lastSmoothedValue = 0;
  private rising = false;

  private currentPeak = -Infinity;
  private currentPeakT = 0;
  private currentValley = Infinity;

  private lastStepT = -Infinity;
  private stepCount = 0;
  private adaptiveThreshold: number;

  constructor() {
    this.adaptiveThreshold = TUG_STEP_INITIAL_THRESHOLD;
  }

  processSample(t: number, verticalAccel: number): DetectedStep | null {
    // Moving average smoothing
    this.smoothBuffer.push(verticalAccel);
    this.smoothSum += verticalAccel;
    if (this.smoothBuffer.length > TUG_STEP_SMOOTH_WINDOW) {
      this.smoothSum -= this.smoothBuffer.shift()!;
    }
    const smoothed = this.smoothSum / this.smoothBuffer.length;

    const derivative = smoothed - this.lastSmoothedValue;
    this.lastSmoothedValue = smoothed;

    // Track peaks and valleys
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
        // Was rising, now falling → peak detected; check if we have a step
        const peakValleyDiff = this.currentPeak - this.currentValley;
        const timeSinceLastStep = t - this.lastStepT;
        const peakToNowInterval = t - this.currentPeakT;

        if (
          peakValleyDiff > this.adaptiveThreshold &&
          timeSinceLastStep >= TUG_STEP_MIN_INTERVAL_MS &&
          peakToNowInterval <= TUG_STEP_PEAK_VALLEY_MAX_MS
        ) {
          // Step detected
          this.stepCount++;
          this.lastStepT = t;

          // Adapt threshold
          this.adaptiveThreshold =
            (1 - TUG_STEP_THRESHOLD_ADAPT_RATE) * this.adaptiveThreshold +
            TUG_STEP_THRESHOLD_ADAPT_RATE * (0.4 * peakValleyDiff);

          const stride = weinbergStride(this.currentPeak, this.currentValley);

          const step: DetectedStep = {
            t,
            peakAccel: this.currentPeak,
            valleyAccel: this.currentValley,
            strideLength: stride,
          };

          // Reset for next step
          this.currentPeak = smoothed;
          this.currentPeakT = t;
          this.currentValley = smoothed;

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
    this.lastStepT = -Infinity;
    this.stepCount = 0;
    this.adaptiveThreshold = TUG_STEP_INITIAL_THRESHOLD;
  }
}
