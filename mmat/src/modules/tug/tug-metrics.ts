import type { RawSessionData, ComputedMetrics } from '../../types/assessment';
import { isTimerEvent } from '../../types/assessment';
import { TUG_NORMAL_THRESHOLD_S, TUG_HIGH_RISK_THRESHOLD_S } from '../../constants';
import type { TugClinicalBand } from './tug-types';

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
