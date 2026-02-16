import { clearContainer, createElement } from '../../utils/dom';
import { createButton } from '../../components/button';
import { getAllResults } from '../../core/db';
import { getClinicalBand, getClinicalLabel } from './tug-metrics';
import { lastTugResult } from './tug-active';
import { router } from '../../main';

const BAND_COLORS: Record<string, { bg: string; text: string }> = {
  normal: { bg: '#E8F5E9', text: '#2E7D32' },
  moderate_risk: { bg: '#FFF8E1', text: '#F57F17' },
  high_risk: { bg: '#FFEBEE', text: '#C62828' },
};

const WALKING_AID_LABELS: Record<string, string> = {
  none: 'no aid',
  cane: 'cane',
  walker: 'walker',
  other: 'other aid',
};

export async function renderTugResults(container: HTMLElement): Promise<void> {
  clearContainer(container);

  if (!lastTugResult) {
    router.navigate('#/menu', true);
    return;
  }

  const result = lastTugResult;
  const m = result.computed_metrics;
  const timeS = m.tug_time_s;
  const band = getClinicalBand(timeS);
  const bandLabel = getClinicalLabel(band);
  const colors = BAND_COLORS[band];

  // Release wake lock if still held
  const wl = (window as unknown as Record<string, unknown>).__tugWakeLock as WakeLockSentinel | undefined;
  if (wl) {
    wl.release().catch(() => {});
    delete (window as unknown as Record<string, unknown>).__tugWakeLock;
  }

  const wrapper = createElement('main', { className: 'assessment-results' });
  wrapper.setAttribute('role', 'main');

  const header = createElement('h1', {
    className: 'assessment-results__header',
    textContent: 'Test Complete!',
  });

  const metricsSection = createElement('section', { className: 'assessment-results__metrics' });

  // Time
  metricsSection.appendChild(
    createMetricCard('Your time', `${timeS.toFixed(1)} seconds`),
  );

  // Clinical band
  const bandCard = createElement('div', { className: 'assessment-results__metric-card' });
  bandCard.style.background = colors.bg;
  bandCard.appendChild(
    createElement('span', {
      className: 'assessment-results__metric-label',
      textContent: 'Clinical interpretation',
    }),
  );
  const bandValue = createElement('span', {
    className: 'assessment-results__metric-value',
    textContent: bandLabel,
  });
  bandValue.style.color = colors.text;
  bandCard.appendChild(bandValue);
  metricsSection.appendChild(bandCard);

  // Walking aid
  const walkingAid = result.session_metadata.walking_aid ?? 'none';
  metricsSection.appendChild(
    createMetricCard('Walking aid', WALKING_AID_LABELS[walkingAid] ?? walkingAid),
  );

  // Flagged warning
  if (result.flagged) {
    const flagCard = createElement('div', { className: 'tug-results__flag-warning' });
    flagCard.textContent = result.flag_reason ?? 'This result has been flagged';
    metricsSection.appendChild(flagCard);
  }

  // Comparison with previous TUG sessions
  const allResults = await getAllResults();
  const previousResults = allResults
    .filter(
      (r) =>
        r.task_type.startsWith('tug') &&
        r.local_uuid !== result.local_uuid &&
        r.status === 'complete' &&
        !r.flagged,
    )
    .sort(
      (a, b) => new Date(b.timestamp_start).getTime() - new Date(a.timestamp_start).getTime(),
    );

  if (previousResults.length >= 1) {
    const lastSession = previousResults[0];
    const lastTime = lastSession.computed_metrics.tug_time_s;
    const change = ((timeS - lastTime) / lastTime) * 100;

    let comparisonText: string;
    if (Math.abs(change) < 5) {
      comparisonText = 'About the same as last time';
    } else if (change < 0) {
      // Lower time is better for TUG
      comparisonText = `${Math.abs(change).toFixed(0)}% faster than last time`;
    } else {
      comparisonText = `${Math.abs(change).toFixed(0)}% slower than last time`;
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
    onClick: () => router.navigate('#/assessment/tug_v1/setup'),
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

const style = document.createElement('style');
style.textContent = `
  .tug-results__flag-warning {
    padding: var(--space-3) var(--space-4);
    background: #FFF3E0;
    border: 1px solid #FF9800;
    border-radius: var(--radius-md);
    text-align: center;
    color: #E65100;
    font-weight: var(--font-weight-medium);
    font-size: var(--font-size-sm);
  }
`;
document.head.appendChild(style);
