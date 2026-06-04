/**
 * TUG step detection via template matching.
 *
 * The chest-mounted vertical-accel signature of a single walking step is a
 * "W" — two downward troughs ~150–250 ms apart with a small bump between.
 * We learn this shape from the participant in calibration and match against
 * it at runtime, replacing amplitude-thresholding entirely.
 */

import {
  TUG_TEMPLATE_LEN,
  TUG_TEMPLATE_DT_MS,
  TUG_TEMPLATE_WARP_FACTORS,
  TUG_TEMPLATE_MIN_INTERVAL_MS,
  TUG_TROUGH_PAIR_MIN_GAP_MS,
  TUG_TROUGH_PAIR_MAX_GAP_MS,
  TUG_TROUGH_PAIR_MIN_INTERVAL_MS,
  TUG_TROUGH_PROMINENCE_RATIO,
  TUG_WEINBERG_K,
} from '../../constants';
import { weinbergStride } from './tug-signal-processing';
import type { DetectedStep } from './tug-signal-processing';

export interface VerticalSample {
  t: number;
  vertical: number;
}

export interface TroughPair {
  t1: number;
  t2: number;
  midT: number;
}

// ───────────────────────────────────────────────────────── trough detection

/** Find local minima with prominence above `minProminence`, separated by at least minSepMs. */
export function findTroughs(samples: VerticalSample[], minProminence: number, minSepMs: number): VerticalSample[] {
  if (samples.length < 3) return [];
  const out: VerticalSample[] = [];
  let lastTroughT = -Infinity;
  for (let i = 1; i < samples.length - 1; i++) {
    const s = samples[i];
    if (s.vertical < samples[i - 1].vertical && s.vertical <= samples[i + 1].vertical) {
      // Prominence: look ±300 ms for the higher of the surrounding maxima.
      const window = 300;
      let leftMax = -Infinity;
      let rightMax = -Infinity;
      for (let j = i - 1; j >= 0 && samples[i].t - samples[j].t <= window; j--) {
        if (samples[j].vertical > leftMax) leftMax = samples[j].vertical;
      }
      for (let j = i + 1; j < samples.length && samples[j].t - samples[i].t <= window; j++) {
        if (samples[j].vertical > rightMax) rightMax = samples[j].vertical;
      }
      const enclosing = Math.min(leftMax, rightMax);
      const prominence = enclosing - s.vertical;
      if (prominence >= minProminence && s.t - lastTroughT >= minSepMs) {
        out.push(s);
        lastTroughT = s.t;
      }
    }
  }
  return out;
}

/**
 * Find trough pairs (W-shaped step events) in a recording. Each pair is two
 * adjacent prominent troughs within [MIN_GAP, MAX_GAP] of each other; pairs
 * must be separated by at least MIN_INTERVAL.
 */
export function findTroughPairs(samples: VerticalSample[]): TroughPair[] {
  if (samples.length < 3) return [];

  // Relative prominence: 20% of the recording's vertical range.
  let vMin = Infinity;
  let vMax = -Infinity;
  for (const s of samples) {
    if (s.vertical < vMin) vMin = s.vertical;
    if (s.vertical > vMax) vMax = s.vertical;
  }
  const minProm = TUG_TROUGH_PROMINENCE_RATIO * (vMax - vMin);

  // Smooth lightly to suppress sample-rate jitter before finding minima.
  const smoothed = smooth(samples, 3);
  const troughs = findTroughs(smoothed, minProm, 60);

  // Pair adjacent troughs.
  const pairs: TroughPair[] = [];
  let i = 0;
  while (i < troughs.length - 1) {
    const a = troughs[i];
    const b = troughs[i + 1];
    const gap = b.t - a.t;
    if (gap >= TUG_TROUGH_PAIR_MIN_GAP_MS && gap <= TUG_TROUGH_PAIR_MAX_GAP_MS) {
      const midT = (a.t + b.t) / 2;
      if (pairs.length === 0 || midT - pairs[pairs.length - 1].midT >= TUG_TROUGH_PAIR_MIN_INTERVAL_MS) {
        pairs.push({ t1: a.t, t2: b.t, midT });
        i += 2;
        continue;
      }
    }
    i += 1;
  }
  return pairs;
}

function smooth(samples: VerticalSample[], window: number): VerticalSample[] {
  if (window <= 1) return samples;
  const out: VerticalSample[] = [];
  const half = Math.floor(window / 2);
  for (let i = 0; i < samples.length; i++) {
    let sum = 0;
    let n = 0;
    for (let j = Math.max(0, i - half); j <= Math.min(samples.length - 1, i + half); j++) {
      sum += samples[j].vertical;
      n += 1;
    }
    out.push({ t: samples[i].t, vertical: sum / n });
  }
  return out;
}

// ────────────────────────────────────────────────────── window extraction

/**
 * Extract a uniformly-resampled window of `length` samples centered on
 * `centerT`, with `dtMs` between samples. Returns null if the window
 * doesn't fully fit within the recorded samples.
 */
export function extractWindow(
  samples: VerticalSample[],
  centerT: number,
  length: number,
  dtMs: number,
): number[] | null {
  if (samples.length < 2) return null;
  const halfSpanMs = ((length - 1) * dtMs) / 2;
  const startT = centerT - halfSpanMs;
  const endT = centerT + halfSpanMs;
  if (startT < samples[0].t || endT > samples[samples.length - 1].t) return null;

  const out: number[] = new Array(length);
  let cursor = 0;
  for (let i = 0; i < length; i++) {
    const tTarget = startT + i * dtMs;
    while (cursor < samples.length - 1 && samples[cursor + 1].t < tTarget) cursor++;
    const a = samples[cursor];
    const b = samples[Math.min(cursor + 1, samples.length - 1)];
    const dt = b.t - a.t;
    out[i] = dt > 0 ? a.vertical + ((tTarget - a.t) / dt) * (b.vertical - a.vertical) : a.vertical;
  }
  return out;
}

// ─────────────────────────────────────────────────────────── normalization

/** Zero-mean, unit-norm. Returns null for degenerate (zero-variance) windows. */
export function normalize(v: number[]): number[] | null {
  if (v.length === 0) return null;
  let mean = 0;
  for (const x of v) mean += x;
  mean /= v.length;
  const centered = v.map((x) => x - mean);
  let energy = 0;
  for (const x of centered) energy += x * x;
  if (energy < 1e-9) return null;
  const norm = Math.sqrt(energy);
  return centered.map((x) => x / norm);
}

/** Average a set of equal-length templates element-wise, then re-normalize. */
export function averageTemplates(templates: number[][]): number[] | null {
  if (templates.length === 0) return null;
  const L = templates[0].length;
  const sum = new Array(L).fill(0);
  for (const t of templates) {
    if (t.length !== L) continue;
    for (let i = 0; i < L; i++) sum[i] += t[i];
  }
  const mean = sum.map((x) => x / templates.length);
  return normalize(mean);
}

// ──────────────────────────────────────────────────────────── correlation

/** Cosine correlation between two normalized vectors of equal length. */
export function correlate(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

/** Linearly resample a template to a different length (used to generate warped variants). */
export function resample(src: number[], newLen: number): number[] {
  const out: number[] = new Array(newLen);
  for (let i = 0; i < newLen; i++) {
    const srcIdx = (i / (newLen - 1)) * (src.length - 1);
    const lo = Math.floor(srcIdx);
    const hi = Math.min(lo + 1, src.length - 1);
    const frac = srcIdx - lo;
    out[i] = src[lo] * (1 - frac) + src[hi] * frac;
  }
  return out;
}

/**
 * Pre-build a set of time-warped variants of a template (each resampled back
 * to the original length so they can be correlated with the same windows).
 * Returns normalized variants.
 */
export function buildWarpVariants(template: number[]): number[][] {
  const L = template.length;
  const variants: number[][] = [];
  for (const factor of TUG_TEMPLATE_WARP_FACTORS) {
    const warpedLen = Math.max(8, Math.round(L * factor));
    const stretched = resample(template, warpedLen);
    const backToL = resample(stretched, L);
    const norm = normalize(backToL);
    if (norm) variants.push(norm);
  }
  if (variants.length === 0) {
    const norm = normalize(template);
    if (norm) variants.push(norm);
  }
  return variants;
}

/** Max correlation across all warp variants. */
export function correlateWithWarp(window: number[], variants: number[][]): number {
  let best = -Infinity;
  for (const v of variants) {
    const c = correlate(window, v);
    if (c > best) best = c;
  }
  return best;
}

/** L2 distance between two templates, normalized by the magnitude of the first. */
export function templateDelta(prev: number[], curr: number[]): number {
  if (prev.length !== curr.length) return 1;
  let d2 = 0;
  let m2 = 0;
  for (let i = 0; i < prev.length; i++) {
    const d = curr[i] - prev[i];
    d2 += d * d;
    m2 += prev[i] * prev[i];
  }
  if (m2 < 1e-9) return 1;
  return Math.sqrt(d2) / Math.sqrt(m2);
}

// ─────────────────────────────────────────────────── batch calibration

export interface BatchResult {
  template: number[];                  // normalized mean template
  pairs: TroughPair[];                 // pairs found this batch
  windowsAdded: number;                // how many W windows extracted
  delta: number | null;                // L2 change vs previous mean (null on first batch)
  correlationFloor: number;            // 0.85 × median(per-window corr against mean)
  totalSteps: number;                  // running total of W windows used
}

/**
 * Run trough-pair detection on a fresh batch of samples, extract the W
 * windows, add them to the pool, recompute the mean template, and report
 * stability metrics.
 */
export function processBatch(
  samples: VerticalSample[],
  windowPool: number[][],
  prevTemplate: number[] | null,
): BatchResult {
  const pairs = findTroughPairs(samples);
  let added = 0;
  for (const p of pairs) {
    const w = extractWindow(samples, p.midT, TUG_TEMPLATE_LEN, TUG_TEMPLATE_DT_MS);
    if (!w) continue;
    const norm = normalize(w);
    if (!norm) continue;
    windowPool.push(norm);
    added += 1;
  }

  const template = averageTemplates(windowPool) ?? [];
  const delta = prevTemplate && template.length > 0
    ? templateDelta(prevTemplate, template)
    : null;

  // Correlation floor: 0.85 × median(per-window corr against mean).
  let floor = 0;
  if (template.length > 0 && windowPool.length > 0) {
    const corrs = windowPool.map((w) => correlate(w, template)).sort((a, b) => a - b);
    const mid = Math.floor(corrs.length / 2);
    const median = corrs.length % 2 === 0 ? (corrs[mid - 1] + corrs[mid]) / 2 : corrs[mid];
    floor = 0.85 * median;
  }

  return { template, pairs, windowsAdded: added, delta, correlationFloor: floor, totalSteps: windowPool.length };
}

// ─────────────────────────────────────────────── runtime template detector

export interface TemplateStepDetectorConfig {
  template: number[];
  correlationFloor: number;
  minIntervalMs: number;
}

/**
 * Streaming template-matching step detector.
 *
 * On each new sample: maintains a rolling buffer covering one template
 * duration. Resamples the buffer onto the template grid, normalizes, and
 * correlates with the learned template (with ±15 % time-warp variants).
 * A step is emitted when the correlation locally peaks above the calibrated
 * floor, with a minimum interval refractory.
 *
 * Weinberg stride length is computed from the vertical-accel min/max
 * accumulated between consecutive confirmed steps.
 */
export class TemplateStepDetector {
  private cfg: TemplateStepDetectorConfig;
  private variants: number[][];
  private buffer: VerticalSample[] = [];
  private bufferSpanMs: number;

  // Correlation peak detection (3-point local max).
  private corrPrev2 = -Infinity;
  private corrPrev1 = -Infinity;
  private corrPrev1T = 0;

  private lastStepT = -Infinity;
  private stepCount = 0;

  // Weinberg accumulators.
  private strideMin = Infinity;
  private strideMax = -Infinity;

  constructor(cfg: TemplateStepDetectorConfig) {
    this.cfg = cfg;
    this.variants = buildWarpVariants(cfg.template);
    this.bufferSpanMs = (TUG_TEMPLATE_LEN - 1) * TUG_TEMPLATE_DT_MS;
  }

  processSample(t: number, vertical: number): DetectedStep | null {
    // Track stride signal min/max regardless of detection state.
    if (vertical < this.strideMin) this.strideMin = vertical;
    if (vertical > this.strideMax) this.strideMax = vertical;

    this.buffer.push({ t, vertical });
    // Trim buffer to template span (plus a small lookahead for centering).
    while (this.buffer.length > 0 && t - this.buffer[0].t > this.bufferSpanMs * 1.5) {
      this.buffer.shift();
    }

    // Need a full template span of data before scoring.
    const span = this.buffer.length > 0 ? t - this.buffer[0].t : 0;
    if (span < this.bufferSpanMs) return null;

    // Score the window ending at this sample. Template center maps to (t - bufferSpan/2).
    const centerT = t - this.bufferSpanMs / 2;
    const window = extractWindow(this.buffer, centerT, TUG_TEMPLATE_LEN, TUG_TEMPLATE_DT_MS);
    if (!window) return null;
    const normWin = normalize(window);
    if (!normWin) return null;

    const corr = correlateWithWarp(normWin, this.variants);
    const corrT = centerT;

    // 3-point local max detection on the correlation timeseries.
    let emitted: DetectedStep | null = null;
    if (
      this.corrPrev1 > this.corrPrev2 &&
      this.corrPrev1 > corr &&
      this.corrPrev1 >= this.cfg.correlationFloor &&
      this.corrPrev1T - this.lastStepT >= this.cfg.minIntervalMs
    ) {
      const stride = this.strideMax > -Infinity && this.strideMin < Infinity
        ? weinbergStride(this.strideMax, this.strideMin, TUG_WEINBERG_K)
        : 0;

      emitted = {
        t: this.corrPrev1T,
        peakT: this.corrPrev1T,
        peakAccel: this.strideMax,
        valleyAccel: this.strideMin,
        strideLength: stride,
      };
      this.lastStepT = this.corrPrev1T;
      this.stepCount += 1;
      this.strideMin = vertical;
      this.strideMax = vertical;
    }

    // Shift correlation buffer.
    this.corrPrev2 = this.corrPrev1;
    this.corrPrev1 = corr;
    this.corrPrev1T = corrT;

    return emitted;
  }

  getStepCount(): number {
    return this.stepCount;
  }

  reset(): void {
    this.buffer = [];
    this.corrPrev2 = -Infinity;
    this.corrPrev1 = -Infinity;
    this.corrPrev1T = 0;
    this.lastStepT = -Infinity;
    this.stepCount = 0;
    this.strideMin = Infinity;
    this.strideMax = -Infinity;
  }
}

// silence unused — re-exported for callers
export const TEMPLATE_MIN_INTERVAL_MS = TUG_TEMPLATE_MIN_INTERVAL_MS;
