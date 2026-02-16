import { clearContainer, createElement } from '../../utils/dom';
import { createButton } from '../../components/button';
import { getAllResults } from '../../core/db';
import { getRhythmLabel, getAccuracyLabel } from './tapping-metrics';
import { lastAssessmentResult } from './tapping-active';
import { router } from '../../main';

export async function renderTappingResults(container: HTMLElement): Promise<void> {
  clearContainer(container);

  if (!lastAssessmentResult) {
    router.navigate('#/menu', true);
    return;
  }

  const result = lastAssessmentResult;
  const m = result.computed_metrics;

  const wrapper = createElement('main', { className: 'assessment-results' });
  wrapper.setAttribute('role', 'main');

  // Header
  const header = createElement('h1', {
    className: 'assessment-results__header',
    textContent: 'Test Complete!',
  });

  // Metrics
  const metricsSection = createElement('section', { className: 'assessment-results__metrics' });

  // Tap count and frequency
  metricsSection.appendChild(
    createMetricCard(
      `You tapped ${m.tap_count} times`,
      `That's ${m.frequency_hz.toFixed(1)} taps per second`,
    ),
  );

  // Rhythm
  const rhythmLabel = getRhythmLabel(m.rhythm_cv);
  metricsSection.appendChild(createMetricCard('Rhythm consistency', rhythmLabel));

  // Accuracy
  const accuracyLabel = getAccuracyLabel(m.accuracy_pct_in_target);
  metricsSection.appendChild(
    createMetricCard('Accuracy', `${accuracyLabel} (${m.accuracy_pct_in_target.toFixed(0)}% in target)`),
  );

  // Comparison with previous sessions
  const allResults = await getAllResults();
  const previousResults = allResults
    .filter(
      (r) =>
        r.task_type.startsWith('tapping') &&
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

    const comparison = createElement('div', { className: 'assessment-results__comparison' });
    comparison.textContent = comparisonText;
    metricsSection.appendChild(comparison);
  }

  // Sync status
  const syncStatus = createElement('div', {
    className: 'assessment-results__sync',
    'aria-live': 'polite',
  });
  syncStatus.textContent = result.synced
    ? 'Synced!'
    : navigator.onLine
      ? 'Results saved. Syncing...'
      : 'Saved locally. Will sync when online.';

  // Trigger sync in background
  if (navigator.onLine) {
    import('../../services/sync-service')
      .then((m) => m.triggerSync())
      .then(async () => {
        // Re-check if this specific result was actually synced
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

  // Actions
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
    onClick: () => router.navigate('#/assessment/tapping_v1/setup'),
  });

  wrapper.appendChild(header);
  wrapper.appendChild(metricsSection);
  wrapper.appendChild(syncStatus);
  wrapper.appendChild(homeBtn);
  wrapper.appendChild(againBtn);
  container.appendChild(wrapper);
}

function createMetricCard(label: string, value: string): HTMLElement {
  const card = createElement('div', { className: 'assessment-results__metric-card' });
  card.appendChild(createElement('span', { className: 'assessment-results__metric-label', textContent: label }));
  card.appendChild(createElement('span', { className: 'assessment-results__metric-value', textContent: value }));
  return card;
}
