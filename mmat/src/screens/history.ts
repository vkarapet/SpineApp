import { clearContainer, createElement } from '../utils/dom';
import { createHeader } from '../components/header';
import { createDeviceFilter } from '../components/device-filter';
import { getAllResults, getProfile, saveResult, addAuditEntry } from '../core/db';
import { formatDateTime } from '../utils/date';
import type { AssessmentResult } from '../types/db-schemas';
import { router, moduleRegistry } from '../main';

let currentFilter: 'all' | 'this' = 'all';
let currentModuleTab: string = 'all';

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

  // Module tabs
  const modules = moduleRegistry.getAllModules();
  if (modules.length > 0) {
    const tabBar = createElement('div', { className: 'history-screen__tabs' });
    tabBar.setAttribute('role', 'tablist');

    // "All" tab
    const allTab = createTab('All', 'all', currentModuleTab === 'all');
    allTab.addEventListener('click', async () => {
      currentModuleTab = 'all';
      updateActiveTab(tabBar);
      await renderList(main, profile.device_id);
    });
    tabBar.appendChild(allTab);

    // One tab per module
    for (const mod of modules) {
      const prefix = mod.id.replace(/_v\d+$/, '');
      const tab = createTab(mod.name, prefix, currentModuleTab === prefix);
      tab.addEventListener('click', async () => {
        currentModuleTab = prefix;
        updateActiveTab(tabBar);
        await renderList(main, profile.device_id);
      });
      tabBar.appendChild(tab);
    }

    main.appendChild(tabBar);
  }

  // Device filter
  const filter = createDeviceFilter(currentFilter, async (f) => {
    currentFilter = f;
    await renderList(main, profile.device_id);
  });

  main.appendChild(filter);

  await renderList(main, profile.device_id);

  container.appendChild(header);
  container.appendChild(main);
}

function createTab(label: string, value: string, active: boolean): HTMLElement {
  const tab = createElement('button', {
    className: `history-screen__tab ${active ? 'history-screen__tab--active' : ''}`,
    textContent: label,
  });
  tab.setAttribute('role', 'tab');
  tab.setAttribute('aria-selected', String(active));
  tab.dataset.tabValue = value;
  return tab;
}

function updateActiveTab(tabBar: HTMLElement): void {
  const tabs = tabBar.querySelectorAll('.history-screen__tab');
  tabs.forEach((tab) => {
    const el = tab as HTMLElement;
    const isActive = el.dataset.tabValue === currentModuleTab;
    el.classList.toggle('history-screen__tab--active', isActive);
    el.setAttribute('aria-selected', String(isActive));
  });
}

async function renderList(main: HTMLElement, deviceId: string): Promise<void> {
  // Remove existing list if any
  const existing = main.querySelector('.history-screen__list');
  if (existing) existing.remove();

  let results = await getAllResults();

  // Filter by module tab
  if (currentModuleTab !== 'all') {
    results = results.filter((r) => r.task_type.startsWith(currentModuleTab));
  }

  // Filter by device
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
      textContent: currentModuleTab === 'all'
        ? 'No assessment history yet.'
        : 'No sessions for this module yet.',
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
  const isGrip = result.task_type.startsWith('grip');
  const countLabel = isGrip ? 'grips' : 'taps';
  left.appendChild(createElement('span', {
    className: 'history-screen__metrics',
    textContent: `${result.computed_metrics.tap_count} ${countLabel} \u2022 ${result.computed_metrics.frequency_hz.toFixed(1)} Hz \u2022 ${result.session_metadata.hand_used}`,
  }));
  if (result.flagged) {
    left.appendChild(createElement('span', {
      className: 'history-screen__flag',
      textContent: `Flagged: ${result.flag_reason ?? 'Not representative'}`,
    }));
  }

  const syncIcon = createElement('span', { className: 'history-screen__sync' });
  syncIcon.innerHTML = result.synced
    ? `<svg width="16" height="16" viewBox="-1 -1 26 26" fill="none" stroke="#34A853" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`
    : `<svg width="16" height="16" viewBox="-1 -1 26 26" fill="none" stroke="#FF6D00" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><circle cx="12" cy="16" r=".5" fill="#FF6D00"/></svg>`;
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
  const isGrip = result.task_type.startsWith('grip');
  const unitLabel = isGrip ? 'grips' : 'taps';
  const countLabel = isGrip ? 'Grips' : 'Taps';
  const spatialLine = isGrip && m.spatial_variance_px !== undefined
    ? `Spatial variance: ${m.spatial_variance_px.toFixed(1)}px\n`
    : `Accuracy: ${m.accuracy_pct_in_target.toFixed(1)}% in target\n`;

  alert(
    `Session Details\n\n` +
    `Date: ${formatDateTime(result.timestamp_start)}\n` +
    `Hand: ${result.session_metadata.hand_used}\n` +
    `${countLabel}: ${m.tap_count}\n` +
    `Speed: ${m.frequency_hz.toFixed(2)} ${unitLabel}/sec\n` +
    `Rhythm CV: ${m.rhythm_cv.toFixed(4)}\n` +
    spatialLine +
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
  .history-screen__tabs {
    display: flex;
    gap: var(--space-2);
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    padding-bottom: var(--space-1);
  }
  .history-screen__tabs::-webkit-scrollbar {
    display: none;
  }
  .history-screen__tab {
    flex-shrink: 0;
    padding: var(--space-2) var(--space-4);
    min-height: var(--tap-target-min);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-full);
    background: var(--color-bg);
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    cursor: pointer;
    white-space: nowrap;
  }
  .history-screen__tab--active {
    background: var(--color-primary);
    color: #fff;
    border-color: var(--color-primary);
  }
  .history-screen__tab:active {
    opacity: 0.8;
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
