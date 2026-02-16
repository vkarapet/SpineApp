import { clearContainer, createElement } from '../../utils/dom';
import { createButton } from '../../components/button';
import { getAllResults } from '../../core/db';
import { getRhythmLabel, getSpatialLabel } from './grip-metrics';
import { lastGripResult } from './grip-active';
import { router } from '../../main';

export async function renderGripResults(container: HTMLElement): Promise<void> {
  clearContainer(container);

  if (!lastGripResult) {
    router.navigate('#/menu', true);
    return;
  }

  const result = lastGripResult;
  const m = result.computed_metrics;

  const wrapper = createElement('main', { className: 'tapping-results' });
  wrapper.setAttribute('role', 'main');

  const header = createElement('h1', {
    className: 'tapping-results__header',
    textContent: 'Test Complete!',
  });

  const metricsSection = createElement('section', { className: 'tapping-results__metrics' });

  // Grip count and frequency
  metricsSection.appendChild(
    createMetricCard(
      `You completed ${m.tap_count} grip/release cycle${m.tap_count !== 1 ? 's' : ''}`,
      `That's ${m.frequency_hz.toFixed(1)} grips per second`,
    ),
  );

  // Rhythm
  const rhythmLabel = getRhythmLabel(m.rhythm_cv);
  metricsSection.appendChild(createMetricCard('Rhythm consistency', rhythmLabel));

  // Spatial consistency
  const spatialVariance = m.spatial_variance_px ?? m.accuracy_mean_dist_px;
  const spatialLabel = getSpatialLabel(spatialVariance);
  metricsSection.appendChild(
    createMetricCard('Spatial consistency', `${spatialLabel} (${spatialVariance.toFixed(1)}px variance)`),
  );

  // Comparison with previous grip sessions
  const allResults = await getAllResults();
  const previousResults = allResults
    .filter(
      (r) =>
        r.task_type.startsWith('grip') &&
        r.local_uuid !== result.local_uuid &&
        r.status === 'complete' &&
        !r.flagged,
    )
    .sort(
      (a, b) => new Date(b.timestamp_start).getTime() - new Date(a.timestamp_start).getTime(),
    );

  if (previousResults.length >= 1) {
    const lastSession = previousResults[0];
    const lastFreq = lastSession.computed_metrics.frequency_hz;
    const change = ((m.frequency_hz - lastFreq) / lastFreq) * 100;

    let comparisonText: string;
    if (Math.abs(change) < 5) {
      comparisonText = 'About the same as last time';
    } else if (change > 0) {
      comparisonText = `That's ${Math.abs(change).toFixed(0)}% faster than last time`;
    } else {
      comparisonText = `That's ${Math.abs(change).toFixed(0)}% slower than last time`;
    }

    const comparison = createElement('div', { className: 'tapping-results__comparison' });
    comparison.textContent = comparisonText;
    metricsSection.appendChild(comparison);
  }

  // Sync status
  const syncStatus = createElement('div', {
    className: 'tapping-results__sync',
    'aria-live': 'polite',
  });
  syncStatus.textContent = result.synced
    ? 'Synced!'
    : navigator.onLine
      ? 'Results saved. Syncing...'
      : 'Saved locally. Will sync when online.';

  if (navigator.onLine) {
    import('../../services/sync-service')
      .then((m) => m.triggerSync())
      .then(async () => {
        const { getResult } = await import('../../core/db');
        const updated = await getResult(result.local_uuid);
        if (updated?.synced) {
          syncStatus.textContent = 'Synced!';
        } else {
          syncStatus.textContent = 'Saved locally. Sync pending.';
        }
      })
      .catch(() => {
        syncStatus.textContent = 'Saved locally. Sync pending.';
      });
  }

  const homeBtn = createButton({
    text: 'Return to Home',
    variant: 'primary',
    fullWidth: true,
    onClick: () => router.navigate('#/menu'),
  });

  const againBtn = createButton({
    text: 'Take Test Again',
    variant: 'secondary',
    fullWidth: true,
    onClick: () => router.navigate('#/assessment/grip_v1/setup'),
  });

  wrapper.appendChild(header);
  wrapper.appendChild(metricsSection);
  wrapper.appendChild(syncStatus);
  wrapper.appendChild(homeBtn);
  wrapper.appendChild(againBtn);
  container.appendChild(wrapper);
}

function createMetricCard(label: string, value: string): HTMLElement {
  const card = createElement('div', { className: 'tapping-results__metric-card' });
  card.appendChild(createElement('span', { className: 'tapping-results__metric-label', textContent: label }));
  card.appendChild(createElement('span', { className: 'tapping-results__metric-value', textContent: value }));
  return card;
}
