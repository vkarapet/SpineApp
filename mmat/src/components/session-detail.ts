import { createElement } from '../utils/dom';
import { formatDateTime } from '../utils/date';
import type { AssessmentResult } from '../types/db-schemas';

export function createSessionDetail(result: AssessmentResult): HTMLElement {
  const m = result.computed_metrics;
  const s = result.session_metadata;

  const container = createElement('div', { className: 'session-detail' });
  container.innerHTML = `
    <h3>Session Details</h3>
    <dl class="session-detail__list">
      <dt>Date</dt><dd>${formatDateTime(result.timestamp_start)}</dd>
      <dt>Hand</dt><dd>${s.hand_used}</dd>
      <dt>Taps</dt><dd>${m.tap_count}</dd>
      <dt>Speed</dt><dd>${m.frequency_hz.toFixed(2)} taps/sec</dd>
      <dt>Rhythm CV</dt><dd>${m.rhythm_cv.toFixed(4)}</dd>
      <dt>Accuracy</dt><dd>${m.accuracy_pct_in_target.toFixed(1)}% in target</dd>
      <dt>Duration</dt><dd>${(m.duration_actual_ms / 1000).toFixed(1)}s</dd>
      <dt>Device</dt><dd>${s.device_os} / ${s.browser}</dd>
      <dt>Synced</dt><dd>${result.synced ? 'Yes' : 'No'}</dd>
      ${result.flagged ? `<dt>Flagged</dt><dd>${result.flag_reason ?? 'Yes'}</dd>` : ''}
    </dl>
  `;

  return container;
}

const style = document.createElement('style');
style.textContent = `
  .session-detail {
    padding: var(--space-4);
    background: var(--color-bg-secondary);
    border-radius: var(--radius-lg);
  }
  .session-detail h3 {
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-bold);
    margin-bottom: var(--space-3);
  }
  .session-detail__list {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: var(--space-2) var(--space-4);
    font-size: var(--font-size-sm);
  }
  .session-detail__list dt {
    color: var(--color-text-secondary);
    font-weight: var(--font-weight-medium);
  }
  .session-detail__list dd {
    font-weight: var(--font-weight-semibold);
  }
`;
document.head.appendChild(style);
