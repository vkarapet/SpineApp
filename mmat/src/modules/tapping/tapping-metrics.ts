import type { RawTapEvent, ComputedMetrics } from '../../types/assessment';

export function computeTappingMetrics(
  rawData: RawTapEvent[],
  targetCenterX: number,
  targetCenterY: number,
  targetRadius: number,
  durationMs: number,
): ComputedMetrics {
  // Filter valid touchstart events
  const validStarts = rawData.filter((e) => e.type === 'start' && !e.rejected);

  const tapCount = validStarts.length;

  // Frequency: taps per second
  const durationSec = durationMs / 1000;
  const frequencyHz = durationSec > 0 ? tapCount / durationSec : 0;

  // Rhythm CV (coefficient of variation of inter-tap intervals)
  let rhythmCv = 0;
  if (validStarts.length >= 2) {
    const intervals: number[] = [];
    for (let i = 1; i < validStarts.length; i++) {
      intervals.push(validStarts[i].t - validStarts[i - 1].t);
    }

    const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    if (mean > 0) {
      const variance =
        intervals.reduce((sum, val) => sum + (val - mean) ** 2, 0) / intervals.length;
      const stddev = Math.sqrt(variance);
      rhythmCv = stddev / mean;
    }
  }

  // Accuracy: mean distance from target center (px)
  let accuracyMeanDistPx = 0;
  let accuracyPctInTarget = 0;

  if (validStarts.length > 0) {
    const distances = validStarts.map((e) => {
      const dx = e.x - targetCenterX;
      const dy = e.y - targetCenterY;
      return Math.sqrt(dx * dx + dy * dy);
    });

    accuracyMeanDistPx = distances.reduce((a, b) => a + b, 0) / distances.length;

    const inTarget = distances.filter((d) => d <= targetRadius).length;
    accuracyPctInTarget = (inTarget / distances.length) * 100;
  }

  return {
    tap_count: tapCount,
    frequency_hz: Math.round(frequencyHz * 100) / 100,
    rhythm_cv: Math.round(rhythmCv * 10000) / 10000,
    accuracy_mean_dist_px: Math.round(accuracyMeanDistPx * 100) / 100,
    accuracy_pct_in_target: Math.round(accuracyPctInTarget * 100) / 100,
    duration_actual_ms: Math.round(durationMs),
  };
}

export function getRhythmLabel(cv: number): string {
  if (cv < 0.1) return 'Good';
  if (cv <= 0.25) return 'Fair';
  return 'Variable';
}

export function getAccuracyLabel(pctInTarget: number): string {
  if (pctInTarget > 90) return 'Excellent';
  if (pctInTarget >= 70) return 'Good';
  return 'Fair';
}
