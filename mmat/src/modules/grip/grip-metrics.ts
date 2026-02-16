import type { RawTapEvent, ComputedMetrics } from '../../types/assessment';
import { GRIP_MIN_FINGERS } from '../../constants';

interface ReconstructedCycle {
  gripTimestamp: number;
  fingers: { x: number; y: number }[];
}

export function computeGripMetrics(
  rawData: RawTapEvent[],
  durationMs: number,
): ComputedMetrics {
  // Reconstruct grip cycles from raw pointer events
  const cycles = reconstructCycles(rawData);

  const gripCount = cycles.length;
  const durationSec = durationMs / 1000;
  const frequencyHz = durationSec > 0 ? gripCount / durationSec : 0;

  // Rhythm CV (coefficient of variation of inter-grip intervals)
  let rhythmCv = 0;
  if (cycles.length >= 2) {
    const intervals: number[] = [];
    for (let i = 1; i < cycles.length; i++) {
      intervals.push(cycles[i].gripTimestamp - cycles[i - 1].gripTimestamp);
    }

    const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    if (mean > 0) {
      const variance =
        intervals.reduce((sum, val) => sum + (val - mean) ** 2, 0) / intervals.length;
      const stddev = Math.sqrt(variance);
      rhythmCv = stddev / mean;
    }
  }

  // Spatial variance: std dev of centroids across grips
  let spatialVariancePx = 0;
  let accuracyPctInTarget = 0;

  if (cycles.length > 0) {
    // Compute centroid for each grip
    const centroids = cycles.map((cycle) => {
      const cx = cycle.fingers.reduce((s, f) => s + f.x, 0) / cycle.fingers.length;
      const cy = cycle.fingers.reduce((s, f) => s + f.y, 0) / cycle.fingers.length;
      return { x: cx, y: cy };
    });

    if (centroids.length >= 2) {
      const meanX = centroids.reduce((s, c) => s + c.x, 0) / centroids.length;
      const meanY = centroids.reduce((s, c) => s + c.y, 0) / centroids.length;
      const variance =
        centroids.reduce((s, c) => s + (c.x - meanX) ** 2 + (c.y - meanY) ** 2, 0) /
        centroids.length;
      spatialVariancePx = Math.sqrt(variance);
    }

    // % of grips with 4+ concurrent touches
    const validGrips = cycles.filter((c) => c.fingers.length >= GRIP_MIN_FINGERS).length;
    accuracyPctInTarget = (validGrips / cycles.length) * 100;
  }

  return {
    tap_count: gripCount,
    frequency_hz: Math.round(frequencyHz * 100) / 100,
    rhythm_cv: Math.round(rhythmCv * 10000) / 10000,
    accuracy_mean_dist_px: Math.round(spatialVariancePx * 100) / 100,
    accuracy_pct_in_target: Math.round(accuracyPctInTarget * 100) / 100,
    duration_actual_ms: Math.round(durationMs),
    grip_count: gripCount,
    spatial_variance_px: Math.round(spatialVariancePx * 100) / 100,
  };
}

function reconstructCycles(rawData: RawTapEvent[]): ReconstructedCycle[] {
  const cycles: ReconstructedCycle[] = [];
  const activePointers = new Map<number, { x: number; y: number }>();
  let gripAchieved = false;
  let currentGripFingers: { x: number; y: number }[] = [];
  let currentGripTimestamp = 0;

  for (const event of rawData) {
    if (event.rejected) continue;

    if (event.type === 'start') {
      activePointers.set(event.touch_id, { x: event.x, y: event.y });

      if (activePointers.size >= GRIP_MIN_FINGERS && !gripAchieved) {
        gripAchieved = true;
        currentGripTimestamp = event.t;
        currentGripFingers = Array.from(activePointers.values()).map((p) => ({
          x: p.x,
          y: p.y,
        }));
      }
    } else if (event.type === 'end') {
      activePointers.delete(event.touch_id);

      if (activePointers.size === 0 && gripAchieved) {
        cycles.push({
          gripTimestamp: currentGripTimestamp,
          fingers: currentGripFingers,
        });
        gripAchieved = false;
        currentGripFingers = [];
      }
    }
  }

  return cycles;
}

export function getRhythmLabel(cv: number): string {
  if (cv < 0.1) return 'Good';
  if (cv <= 0.25) return 'Fair';
  return 'Variable';
}

export function getSpatialLabel(variance: number): string {
  if (variance < 15) return 'Very Consistent';
  if (variance <= 30) return 'Consistent';
  return 'Variable';
}
