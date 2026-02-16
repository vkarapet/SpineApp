import { clearContainer, createElement } from '../utils/dom';
import { createHeader } from '../components/header';
import { createDeviceFilter } from '../components/device-filter';
import { getAllResults, getProfile, saveResult, addAuditEntry } from '../core/db';
import { formatDateTime } from '../utils/date';
import type { AssessmentResult } from '../types/db-schemas';
import { router } from '../main';

let currentFilter: 'all' | 'this' = 'all';

export async function renderHistory(container: HTMLElement): Promise<void> {
  clearContainer(container);

  const profile = await getProfile();
  if (!profile) {
    router.navigate('#/splash', true);
    return;
  }

  const header = createHeader({
    title: 'History',
    showBack: true,
    onBack: () => router.navigate('#/menu'),
  });

  const main = createElement('main', { className: 'history-screen' });
  main.setAttribute('role', 'main');

  const filter = createDeviceFilter(currentFilter, async (f) => {
    currentFilter = f;
    await renderList(main, profile.device_id);
  });

  main.appendChild(filter);

  await renderList(main, profile.device_id);

  container.appendChild(header);
  container.appendChild(main);
}

async function renderList(main: HTMLElement, deviceId: string): Promise<void> {
  // Remove existing list if any
  const existing = main.querySelector('.history-screen__list');
  if (existing) existing.remove();

  let results = await getAllResults();

  if (currentFilter === 'this') {
    results = results.filter((r) => r.device_id === deviceId);
  }

  results.sort(
    (a, b) => new Date(b.timestamp_start).getTime() - new Date(a.timestamp_start).getTime(),
  );

  const list = createElement('div', { className: 'history-screen__list' });
  list.setAttribute('role', 'list');

  if (results.length === 0) {
    const empty = createElement('p', {
      className: 'history-screen__empty',
      textContent: 'No assessment history yet.',
    });
    list.appendChild(empty);
  } else {
    for (const result of results) {
      list.appendChild(createHistoryRow(result));
    }
  }

  main.appendChild(list);
}

function createHistoryRow(result: AssessmentResult): HTMLElement {
  const row = createElement('button', {
    className: `history-screen__row ${result.flagged ? 'history-screen__row--flagged' : ''}`,
  });
  row.setAttribute('role', 'listitem');

  const left = createElement('div', { className: 'history-screen__row-left' });
  left.appendChild(createElement('span', {
    className: 'history-screen__date',
    textContent: formatDateTime(result.timestamp_start),
  }));
  left.appendChild(createElement('span', {
    className: 'history-screen__metrics',
    textContent: `${result.computed_metrics.tap_count} taps \u2022 ${result.computed_metrics.frequency_hz.toFixed(1)} Hz \u2022 ${result.session_metadata.hand_used}`,
  }));
  if (result.flagged) {
    left.appendChild(createElement('span', {
      className: 'history-screen__flag',
      textContent: `Flagged: ${result.flag_reason ?? 'Not representative'}`,
    }));
  }

  const syncIcon = createElement('span', { className: 'history-screen__sync' });
  syncIcon.innerHTML = result.synced
    ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#34A853" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>`
    : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FF6D00" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>`;
  syncIcon.setAttribute('aria-label', result.synced ? 'Synced' : 'Pending sync');

  row.appendChild(left);
  row.appendChild(syncIcon);

  // Tap for detail
  row.addEventListener('click', () => {
    showSessionDetail(result);
  });

  // Long press for flagging
  let longPressTimer: ReturnType<typeof setTimeout>;
  row.addEventListener('pointerdown', () => {
    longPressTimer = setTimeout(() => {
      showFlagDialog(result);
    }, 500);
  });
  row.addEventListener('pointerup', () => clearTimeout(longPressTimer));
  row.addEventListener('pointerleave', () => clearTimeout(longPressTimer));

  return row;
}

function showSessionDetail(result: AssessmentResult): void {
  const m = result.computed_metrics;
  alert(
    `Session Details\n\n` +
    `Date: ${formatDateTime(result.timestamp_start)}\n` +
    `Hand: ${result.session_metadata.hand_used}\n` +
    `Taps: ${m.tap_count}\n` +
    `Speed: ${m.frequency_hz.toFixed(2)} taps/sec\n` +
    `Rhythm CV: ${m.rhythm_cv.toFixed(4)}\n` +
    `Accuracy: ${m.accuracy_pct_in_target.toFixed(1)}% in target\n` +
    `Duration: ${(m.duration_actual_ms / 1000).toFixed(1)}s\n` +
    `Synced: ${result.synced ? 'Yes' : 'No'}\n` +
    `Device: ${result.device_id.slice(0, 8)}...`,
  );
}

function showFlagDialog(result: AssessmentResult): void {
  const reason = prompt(
    'Mark this session as not representative?\n\nOptional reason (e.g., "phone slipped", "was distracted"):',
  );

  if (reason === null) return; // cancelled

  result.flagged = true;
  result.flag_reason = reason || 'Not representative';
  result.status = 'flagged';

  saveResult(result);
  addAuditEntry({
    action: 'assessment_flagged',
    entity_id: result.local_uuid,
    details: { reason: result.flag_reason },
  });

  // Re-render
  const container = document.getElementById('app');
  if (container) renderHistory(container);
}

const style = document.createElement('style');
style.textContent = `
  .history-screen {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    padding: var(--space-4);
    padding-bottom: calc(var(--space-8) + var(--safe-area-bottom));
    max-width: 40rem;
    margin: 0 auto;
  }
  .history-screen__list {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .history-screen__empty {
    text-align: center;
    color: var(--color-text-secondary);
    padding: var(--space-8);
  }
  .history-screen__row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-3) var(--space-4);
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    cursor: pointer;
    text-align: left;
    width: 100%;
    min-height: var(--tap-target-preferred);
  }
  .history-screen__row:active {
    background: var(--color-bg-secondary);
  }
  .history-screen__row--flagged {
    opacity: 0.6;
  }
  .history-screen__row-left {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }
  .history-screen__date {
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
  }
  .history-screen__metrics {
    font-size: var(--font-size-xs);
    color: var(--color-text-secondary);
  }
  .history-screen__flag {
    font-size: var(--font-size-xs);
    color: var(--color-warning);
    font-style: italic;
  }
  .history-screen__sync {
    display: flex;
    flex-shrink: 0;
  }
`;
document.head.appendChild(style);
