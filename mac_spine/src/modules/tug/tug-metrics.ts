import type { RawSessionData, ComputedMetrics } from '../../types/assessment';
import { isTimerEvent } from '../../types/assessment';
import { TUG_NORMAL_THRESHOLD_S, TUG_HIGH_RISK_THRESHOLD_S } from '../../constants';
import type { TugClinicalBand, PhaseTransition, WalkOutPhaseData } from './tug-types';

export function computeTugMetrics(rawData: RawSessionData): ComputedMetrics {
  const timerEvents = rawData.filter(isTimerEvent);

  const startEvent = timerEvents.find((e) => e.event === 'start');
  const stopEvent = timerEvents.find((e) => e.event === 'stop');

  if (!startEvent || !stopEvent) {
    return { duration_actual_ms: 0, tug_time_s: 0 };
  }

  const durationMs = stopEvent.t - startEvent.t;
  const timeS = Math.round((durationMs / 1000) * 10) / 10;

  return {
    duration_actual_ms: Math.round(durationMs),
    tug_time_s: timeS,
  };
}

function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function sd(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  const variance = xs.reduce((acc, x) => acc + (x - m) ** 2, 0) / (xs.length - 1);
  return Math.sqrt(variance);
}

function cv(xs: number[]): number {
  const m = mean(xs);
  if (m === 0) return 0;
  return sd(xs) / m;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const round3 = (n: number) => Math.round(n * 1000) / 1000;

export function computeTugSensorMetrics(
  rawData: RawSessionData,
  _phaseTransitions: PhaseTransition[],
  walkOut: WalkOutPhaseData,
): ComputedMetrics {
  const base = computeTugMetrics(rawData);

  const firstStepT = walkOut.firstStepT;
  const totalSteps = walkOut.steps;
  const strides = walkOut.strideLengths;
  const stepIntervals = walkOut.stepIntervals;

  // Time to first step: from test start (t=0) to firstStep — soft proxy for
  // stand-up duration. Robust because it just waits for the step detector.
  const timeToFirstStepMs = firstStepT ?? 0;

  // Gait window: [firstStepT, lastStepT]. The first step is the boundary
  // marker (it traversed the time before firstStepT, which we excluded), so
  // it doesn't count toward in-window distance, step count, or stride stats.
  const inWindowSteps = Math.max(0, totalSteps - 1);
  const inWindowStrides = strides.slice(1);
  const inWindowDistance = inWindowStrides.reduce((a, b) => a + b, 0);
  const windowMs = firstStepT !== null && walkOut.lastStepT !== null
    ? walkOut.lastStepT - firstStepT
    : 0;
  const windowS = windowMs / 1000;

  const avgStride = mean(inWindowStrides);
  const strideCv = cv(inWindowStrides);
  const avgStepTimeMs = mean(stepIntervals);
  const stepTimeCv = cv(stepIntervals);
  const cadenceSpm = windowS > 0 ? (inWindowSteps * 60) / windowS : 0;
  const gaitSpeed = windowS > 0 ? inWindowDistance / windowS : 0;

  return {
    ...base,
    time_to_first_step_ms: Math.round(timeToFirstStepMs),
    // Whole walk-out totals (intuitive display values)
    walk_out_steps: totalSteps,
    walk_out_distance_m: round2(walkOut.distance),
    // Gait-window duration (firstStep -> lastStep / 3 m beep)
    walk_out_duration_ms: Math.round(windowMs),
    walk_out_avg_stride_length_m: round2(avgStride),
    walk_out_stride_cv: round3(strideCv),
    walk_out_cadence_spm: round2(cadenceSpm),
    walk_out_avg_step_time_ms: Math.round(avgStepTimeMs),
    walk_out_step_time_cv: round3(stepTimeCv),
    walk_out_gait_speed_mps: round2(gaitSpeed),
  };
}

export function getClinicalBand(timeS: number): TugClinicalBand {
  if (timeS <= TUG_NORMAL_THRESHOLD_S) return 'normal';
  if (timeS <= TUG_HIGH_RISK_THRESHOLD_S) return 'moderate_risk';
  return 'high_risk';
}

export function getClinicalLabel(band: TugClinicalBand): string {
  switch (band) {
    case 'normal':
      return 'Normal mobility';
    case 'moderate_risk':
      return 'Moderate fall risk';
    case 'high_risk':
      return 'High fall risk';
  }
}
