import { clearContainer, createElement } from '../utils/dom';
import { createHeader } from '../components/header';
import { createProfileWidget } from '../components/profile-widget';
import { createSyncStatus } from '../components/sync-status';
import { createModuleCard } from '../components/module-card';
import { getProfile, getUnsyncedResults, getAllResults, getResultsByTaskPrefix } from '../core/db';
import { formatDate } from '../utils/date';
import { initConnectivityMonitor } from '../components/connectivity-indicator';
import { router, moduleRegistry } from '../main';

export async function renderMenu(container: HTMLElement): Promise<void> {
  clearContainer(container);

  const profile = await getProfile();
  if (!profile) {
    router.navigate('#/splash', true);
    return;
  }

  const header = createHeader({
    title: 'Mobile Modular Assessment Tool',
    showSettings: true,
    showHelp: true,
    onSettings: () => router.navigate('#/settings'),
    onHelp: () => router.navigate('#/help'),
  });

  const main = createElement('main', { className: 'menu-screen' });
  main.setAttribute('role', 'main');

  // Profile widget
  const profileWidget = createProfileWidget(
    profile.first_name,
    () => router.navigate('#/profile'),
  );

  // Sync status
  const unsyncedResults = await getUnsyncedResults();
  let syncStatusEl = createSyncStatus({
    pendingCount: unsyncedResults.length,
    lastSyncedAt: profile.last_synced_at ?? null,
    onSyncNow: handleSyncNow,
  });

  async function handleSyncNow(): Promise<void> {
    try {
      const { triggerSync } = await import('../services/sync-service');
      await triggerSync();
    } catch {
      // sync errors handled internally
    }
    // Refresh the sync status widget in place
    const freshUnsynced = await getUnsyncedResults();
    const freshProfile = await getProfile();
    const newSyncStatus = createSyncStatus({
      pendingCount: freshUnsynced.length,
      lastSyncedAt: freshProfile?.last_synced_at ?? null,
      onSyncNow: handleSyncNow,
    });
    syncStatusEl.replaceWith(newSyncStatus);
    syncStatusEl = newSyncStatus;
  }

  // Last assessed
  const allResults = await getAllResults();
  const lastResult = allResults.sort(
    (a, b) => new Date(b.timestamp_start).getTime() - new Date(a.timestamp_start).getTime(),
  )[0];

  const lastAssessed = createElement('p', {
    className: 'menu-screen__last-assessed',
    textContent: lastResult
      ? `Last assessed: ${formatDate(lastResult.timestamp_start)}`
      : "You haven't completed an assessment yet.",
  });

  // Module cards
  const modulesSection = createElement('section', { className: 'menu-screen__modules' });
  modulesSection.setAttribute('aria-label', 'Available assessments');

  // Modules are registered in bootstrap (main.ts) before routing starts
  const modules = moduleRegistry.getAllModules();
  if (modules.length > 0) {
    await addModuleCards(modulesSection);
  } else {
    await addDefaultCard(modulesSection);
  }

  // View History link
  const historyLink = createElement('button', {
    className: 'menu-screen__history-link',
    textContent: 'View History',
    'aria-label': 'View assessment history',
  });
  historyLink.addEventListener('click', () => router.navigate('#/history'));

  main.appendChild(profileWidget);
  main.appendChild(syncStatusEl);
  main.appendChild(lastAssessed);
  main.appendChild(modulesSection);
  main.appendChild(historyLink);

  container.appendChild(header);
  container.appendChild(main);

  initConnectivityMonitor();
}

async function addModuleCards(
  section: HTMLElement,
): Promise<void> {
  const modules = moduleRegistry.getAllModules();
  for (const mod of modules) {
    const moduleResults = await getResultsByTaskPrefix(mod.id.replace(/_v\d+$/, ''));
    const sorted = moduleResults
      .filter((r) => r.status === 'complete' && !r.flagged)
      .sort((a, b) => new Date(a.timestamp_start).getTime() - new Date(b.timestamp_start).getTime());

    const sparklineValues = sorted.map((r) => mod.getSparklineValue(r));
    const lastForModule = sorted[sorted.length - 1];

    const card = createModuleCard({
      name: mod.name,
      description: mod.description,
      lastCompleted: lastForModule?.timestamp_start ?? null,
      sparklineValues,
      onClick: () => router.navigate(`#/assessment/${mod.id}/setup`),
    });
    section.appendChild(card);
  }
}

async function addDefaultCard(
  section: HTMLElement,
): Promise<void> {
  const moduleResults = await getResultsByTaskPrefix('tapping');
  const sorted = moduleResults
    .filter((r) => r.status === 'complete' && !r.flagged)
    .sort((a, b) => new Date(a.timestamp_start).getTime() - new Date(b.timestamp_start).getTime());

  const sparklineValues = sorted.map((r) => r.computed_metrics.frequency_hz ?? 0);
  const lastForModule = sorted[sorted.length - 1];

  const card = createModuleCard({
    name: 'Rapid Tapping Task',
    description: 'Measure motor speed, rhythm, and accuracy',
    lastCompleted: lastForModule?.timestamp_start ?? null,
    sparklineValues,
    onClick: () => router.navigate('#/assessment/tapping_v1/setup'),
  });
  section.appendChild(card);
}

const style = document.createElement('style');
style.textContent = `
  .menu-screen {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    padding: var(--space-4);
    padding-bottom: calc(var(--space-8) + var(--safe-area-bottom));
    max-width: 40rem;
    margin: 0 auto;
  }
  .menu-screen__last-assessed {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    text-align: center;
  }
  .menu-screen__modules {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .menu-screen__history-link {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: var(--tap-target-min);
    padding: var(--space-3);
    color: var(--color-primary);
    font-weight: var(--font-weight-semibold);
    background: none;
    border: none;
    cursor: pointer;
    font-size: var(--font-size-base);
  }
  .menu-screen__history-link:active {
    background: var(--color-bg-secondary);
    border-radius: var(--radius-md);
  }
`;
document.head.appendChild(style);
