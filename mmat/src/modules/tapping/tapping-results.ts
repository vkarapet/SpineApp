import { clearContainer, createElement } from '../../utils/dom';
import { createButton } from '../../components/button';
import { createSaveDiscardSlider } from '../../components/save-discard-slider';
import { getAllResults, saveResult, deleteResult, addAuditEntry } from '../../core/db';
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

  // Save/discard slider
  const syncStatus = createElement('div', {
    className: 'assessment-results__sync',
    'aria-live': 'polite',
  });
  syncStatus.style.display = 'none';

  const slider = createSaveDiscardSlider({
    onSave: async () => {
      result.status = result.flagged ? 'flagged' : 'complete';
      await saveResult(result);
      await addAuditEntry({
        action: 'assessment_completed',
        entity_id: result.local_uuid,
        details: { task_type: 'tapping_v1', tap_count: m.tap_count, decision: 'saved' },
      });
      homeBtn.disabled = false;
      homeBtn.classList.remove('btn--disabled');
      againBtn.disabled = false;
      againBtn.classList.remove('btn--disabled');
      syncStatus.style.display = '';
      syncStatus.textContent = navigator.onLine ? 'Saved. Syncing...' : 'Saved locally. Will sync when online.';
      if (navigator.onLine) {
        import('../../services/sync-service')
          .then((mod) => mod.triggerSync())
          .then(async () => {
            const { getResult } = await import('../../core/db');
            const updated = await getResult(result.local_uuid);
            syncStatus.textContent = updated?.synced ? 'Synced!' : 'Saved locally. Sync pending.';
          })
          .catch(() => { syncStatus.textContent = 'Saved locally. Sync pending.'; });
      }
    },
    onDiscard: async () => {
      await deleteResult(result.local_uuid);
      await addAuditEntry({
        action: 'assessment_flagged',
        entity_id: result.local_uuid,
        details: { task_type: 'tapping_v1', decision: 'discarded' },
      });
      homeBtn.disabled = false;
      homeBtn.classList.remove('btn--disabled');
      againBtn.disabled = false;
      againBtn.classList.remove('btn--disabled');
      syncStatus.style.display = '';
      syncStatus.textContent = 'Result discarded.';
    },
  });

  // Actions — disabled until save/discard decision
  const homeBtn = createButton({
    text: 'Return to Home',
    variant: 'primary',
    fullWidth: true,
    disabled: true,
    onClick: () => router.navigate('#/menu'),
  });

  const againBtn = createButton({
    text: 'Take Test Again',
    variant: 'secondary',
    fullWidth: true,
    disabled: true,
    onClick: () => router.navigate('#/assessment/tapping_v1/setup'),
  });

  wrapper.appendChild(header);
  wrapper.appendChild(metricsSection);
  wrapper.appendChild(slider);
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
