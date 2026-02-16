import { getAllResults, getResultsByTaskPrefix, getProfile } from '../core/db';
import type { ChartDataPoint } from '../lib/chart-manager';
import type { AssessmentResult } from '../types/db-schemas';

export interface ChartDataSet {
  data: ChartDataPoint[];
  metricKey: string;
  metricLabel: string;
}

export async function getChartData(
  taskPrefix: string,
  metricKey: string,
  deviceFilter: 'all' | 'this' = 'all',
): Promise<ChartDataPoint[]> {
  let results = await getResultsByTaskPrefix(taskPrefix);
  const profile = await getProfile();

  if (deviceFilter === 'this' && profile) {
    results = results.filter((r) => r.device_id === profile.device_id);
  }

  // Sort by date
  results.sort(
    (a, b) => new Date(a.timestamp_start).getTime() - new Date(b.timestamp_start).getTime(),
  );

  return results.map((r) => ({
    x: new Date(r.timestamp_start),
    y: getMetricValue(r, metricKey),
    hand: r.session_metadata.hand_used,
    isRestored: profile ? r.device_id !== profile.device_id : false,
    isFlagged: r.flagged,
  }));
}

function getMetricValue(result: AssessmentResult, key: string): number {
  const m = result.computed_metrics;

  switch (key) {
    case 'frequency_hz':
      return m.frequency_hz;
    case 'rhythm_cv':
      // Invert so higher = more consistent (display as 0-100 scale)
      return Math.round((1 - m.rhythm_cv) * 100);
    case 'accuracy_pct_in_target':
      return m.accuracy_pct_in_target;
    default:
      return 0;
  }
}

export async function getSessionCount(): Promise<number> {
  const results = await getAllResults();
  return results.filter((r) => r.status === 'complete').length;
}

export async function getLatestResult(taskPrefix: string): Promise<AssessmentResult | null> {
  const results = await getResultsByTaskPrefix(taskPrefix);
  const complete = results.filter((r) => r.status === 'complete' && !r.flagged);
  if (complete.length === 0) return null;

  complete.sort(
    (a, b) => new Date(b.timestamp_start).getTime() - new Date(a.timestamp_start).getTime(),
  );
  return complete[0];
}
