import { clearContainer, createElement } from '../../utils/dom';
import { createButton } from '../../components/button';
import { getAllResults } from '../../core/db';
import { getClinicalBand, getClinicalLabel } from './tug-metrics';
import { TUG_PHASE_LABELS } from './tug-types';
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

  // ─── Phase Breakdown ────────────────────────────────────────
  if (m.phases_completed > 0) {
    const phaseSection = createElement('section', { className: 'tug-results__phase-section' });
    phaseSection.appendChild(
      createElement('h2', {
        className: 'tug-results__section-title',
        textContent: 'Phase Breakdown',
      }),
    );

    const phaseTable = createElement('div', { className: 'tug-results__phase-table' });

    const phases: { key: string; label: string; durationKey: string }[] = [
      { key: 'standing_up', label: TUG_PHASE_LABELS.standing_up, durationKey: 'standup_duration_ms' },
      { key: 'walking_out', label: TUG_PHASE_LABELS.walking_out, durationKey: 'walk_out_duration_ms' },
      { key: 'turning_out', label: TUG_PHASE_LABELS.turning_out, durationKey: 'turn_out_duration_ms' },
      { key: 'walking_back', label: TUG_PHASE_LABELS.walking_back, durationKey: 'walk_back_duration_ms' },
      { key: 'turning_sit', label: 'Turn (return)', durationKey: 'turn_sit_duration_ms' },
      { key: 'sitting_down', label: TUG_PHASE_LABELS.sitting_down, durationKey: 'sitdown_duration_ms' },
    ];

    for (const phase of phases) {
      const durationMs = m[phase.durationKey] ?? 0;
      if (durationMs === 0) continue;
      const row = createElement('div', { className: 'tug-results__phase-row' });
      row.appendChild(createElement('span', { textContent: phase.label }));
      row.appendChild(createElement('span', {
        className: 'tug-results__phase-duration',
        textContent: `${(durationMs / 1000).toFixed(1)}s`,
      }));
      phaseTable.appendChild(row);
    }

    phaseSection.appendChild(phaseTable);
    metricsSection.appendChild(phaseSection);

    // ─── Gait Analysis ───────────────────────────────────────────
    const gaitSection = createElement('section', { className: 'tug-results__phase-section' });
    gaitSection.appendChild(
      createElement('h2', {
        className: 'tug-results__section-title',
        textContent: 'Gait Analysis',
      }),
    );

    const gaitGrid = createElement('div', { className: 'tug-results__gait-grid' });
    gaitGrid.appendChild(createMetricCard('Total steps', String(m.total_steps ?? 0)));
    gaitGrid.appendChild(createMetricCard('Total distance', `${(m.total_distance_m ?? 0).toFixed(1)}m`));
    gaitGrid.appendChild(createMetricCard('Avg stride', `${(m.avg_stride_length_m ?? 0).toFixed(2)}m`));
    gaitSection.appendChild(gaitGrid);
    metricsSection.appendChild(gaitSection);

    // ─── Outbound vs Return ──────────────────────────────────────
    if ((m.walk_out_steps ?? 0) > 0 || (m.walk_back_steps ?? 0) > 0) {
      const compareSection = createElement('section', { className: 'tug-results__phase-section' });
      compareSection.appendChild(
        createElement('h2', {
          className: 'tug-results__section-title',
          textContent: 'Outbound vs Return',
        }),
      );

      const compareTable = createElement('div', { className: 'tug-results__compare-table' });

      // Header row
      const headerRow = createElement('div', { className: 'tug-results__compare-row tug-results__compare-header' });
      headerRow.appendChild(createElement('span', { textContent: '' }));
      headerRow.appendChild(createElement('span', { textContent: 'Outbound' }));
      headerRow.appendChild(createElement('span', { textContent: 'Return' }));
      compareTable.appendChild(headerRow);

      // Steps row
      const stepsRow = createElement('div', { className: 'tug-results__compare-row' });
      stepsRow.appendChild(createElement('span', { textContent: 'Steps' }));
      stepsRow.appendChild(createElement('span', { textContent: String(m.walk_out_steps ?? 0) }));
      stepsRow.appendChild(createElement('span', { textContent: String(m.walk_back_steps ?? 0) }));
      compareTable.appendChild(stepsRow);

      // Distance row
      const distRow = createElement('div', { className: 'tug-results__compare-row' });
      distRow.appendChild(createElement('span', { textContent: 'Distance' }));
      distRow.appendChild(createElement('span', { textContent: `${(m.walk_out_distance_m ?? 0).toFixed(1)}m` }));
      distRow.appendChild(createElement('span', { textContent: `${(m.walk_back_distance_m ?? 0).toFixed(1)}m` }));
      compareTable.appendChild(distRow);

      // Duration row
      const durRow = createElement('div', { className: 'tug-results__compare-row' });
      durRow.appendChild(createElement('span', { textContent: 'Duration' }));
      durRow.appendChild(createElement('span', { textContent: `${((m.walk_out_duration_ms ?? 0) / 1000).toFixed(1)}s` }));
      durRow.appendChild(createElement('span', { textContent: `${((m.walk_back_duration_ms ?? 0) / 1000).toFixed(1)}s` }));
      compareTable.appendChild(durRow);

      compareSection.appendChild(compareTable);
      metricsSection.appendChild(compareSection);
    }
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
  .tug-results__phase-section {
    margin-top: var(--space-4);
  }
  .tug-results__section-title {
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-semibold);
    color: var(--color-text);
    margin: 0 0 var(--space-2) 0;
  }
  .tug-results__phase-table {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    background: var(--color-bg-secondary);
    border-radius: var(--radius-md);
    padding: var(--space-3);
  }
  .tug-results__phase-row {
    display: flex;
    justify-content: space-between;
    font-size: var(--font-size-sm);
    padding: var(--space-1) 0;
  }
  .tug-results__phase-duration {
    font-weight: var(--font-weight-semibold);
    font-variant-numeric: tabular-nums;
  }
  .tug-results__gait-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-2);
  }
  .tug-results__gait-grid .assessment-results__metric-card {
    padding: var(--space-2) var(--space-3);
  }
  .tug-results__gait-grid .assessment-results__metric-value {
    font-size: var(--font-size-base);
  }
  .tug-results__compare-table {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    background: var(--color-bg-secondary);
    border-radius: var(--radius-md);
    padding: var(--space-3);
  }
  .tug-results__compare-row {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    font-size: var(--font-size-sm);
    padding: var(--space-1) 0;
    text-align: center;
  }
  .tug-results__compare-row span:first-child {
    text-align: left;
    font-weight: var(--font-weight-medium);
  }
  .tug-results__compare-header {
    font-weight: var(--font-weight-semibold);
    border-bottom: 1px solid var(--color-border, #e0e0e0);
    padding-bottom: var(--space-2);
    margin-bottom: var(--space-1);
  }
`;
document.head.appendChild(style);
