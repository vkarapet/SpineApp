/**
 * TUG normative reference data.
 *
 * Strong evidence: Bohannon RW. Reference values for the Timed Up and Go test:
 *   a descriptive meta-analysis. J Geriatr Phys Ther. 2006;29(2):64-68.
 *
 * Indicative (pooled / smaller-sample): values for adults under 60 are not
 * well-standardised in the literature; the ranges below reflect general
 * agreement that healthy younger adults complete TUG in roughly 5-7 seconds.
 *
 * Fall-risk cutoff (>=13.5s): Shumway-Cook A, et al. Phys Ther. 2000;80(9):896-903.
 */

import { TUG_HIGH_RISK_THRESHOLD_S } from '../../constants';

export type NormativeSource = 'Bohannon 2006' | 'Indicative';

export interface NormativeBand {
  ageMin: number;
  ageMax: number;
  mean: number;
  ci: [number, number];
  source: NormativeSource;
}

export const TUG_NORMATIVE_BANDS: NormativeBand[] = [
  { ageMin: 18, ageMax: 39, mean: 6.0,  ci: [5.0, 7.0],   source: 'Indicative' },
  { ageMin: 40, ageMax: 59, mean: 6.5,  ci: [5.5, 7.5],   source: 'Indicative' },
  { ageMin: 60, ageMax: 69, mean: 8.1,  ci: [7.1, 9.0],   source: 'Bohannon 2006' },
  { ageMin: 70, ageMax: 79, mean: 9.2,  ci: [8.2, 10.2],  source: 'Bohannon 2006' },
  { ageMin: 80, ageMax: 99, mean: 11.3, ci: [10.0, 12.7], source: 'Bohannon 2006' },
];

export const TUG_FALL_RISK_S = TUG_HIGH_RISK_THRESHOLD_S;

export function getNormativeForAge(age: number | null): NormativeBand | null {
  if (age === null || !Number.isFinite(age)) return null;
  return TUG_NORMATIVE_BANDS.find((b) => age >= b.ageMin && age <= b.ageMax) ?? null;
}

export type TrafficLight = 'green' | 'yellow' | 'red';

export function getTrafficLight(tugTimeS: number, age: number | null): TrafficLight {
  if (tugTimeS >= TUG_FALL_RISK_S) return 'red';
  const band = getNormativeForAge(age);
  const greenCeiling = band ? band.ci[1] : 10;
  if (tugTimeS <= greenCeiling) return 'green';
  return 'yellow';
}

export function describeBand(band: NormativeBand): string {
  const ciText = `${band.ci[0].toFixed(1)}-${band.ci[1].toFixed(1)}`;
  return `Typical for ages ${band.ageMin}-${band.ageMax}: ${band.mean.toFixed(1)}s (${ciText})`;
}
