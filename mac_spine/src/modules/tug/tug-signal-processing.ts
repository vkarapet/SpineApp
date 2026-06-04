import { TUG_WEINBERG_K } from '../../constants';

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
  /** Time the step was confirmed (after the valley following the peak). */
  t: number;
  /** Time of the peak in the detection signal — the visual "bump" of the step. */
  peakT: number;
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

