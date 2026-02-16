import { Router } from './core/router';
import { initDB } from './core/db';
import { EventBus } from './core/event-bus';
import { ModuleRegistry } from './core/module-registry';
import { renderSplash } from './screens/splash';

export const router = new Router();
export const eventBus = new EventBus();
export const moduleRegistry = new ModuleRegistry();

async function bootstrap() {
  try {
    await initDB();
  } catch (err) {
    console.error('Failed to initialize database:', err);
  }

  const app = document.getElementById('app');
  if (!app) return;

  // Register routes
  router.register('#/splash', (container) => renderSplash(container));

  // Dynamic imports for other screens to keep initial bundle small
  router.register('#/consent', async (container) => {
    const { renderConsent } = await import('./screens/consent');
    renderConsent(container);
  });

  router.register('#/profile-setup', async (container) => {
    const { renderProfileSetup } = await import('./screens/profile-setup');
    renderProfileSetup(container);
  });

  router.register('#/confirmation', async (container) => {
    const { renderConfirmation } = await import('./screens/confirmation');
    renderConfirmation(container);
  });

  router.register('#/data-restore', async (container) => {
    const { renderDataRestore } = await import('./screens/data-restore');
    renderDataRestore(container);
  });

  router.register('#/menu', async (container) => {
    const { renderMenu } = await import('./screens/menu');
    renderMenu(container);
  });

  router.register('#/settings', async (container) => {
    const { renderSettings } = await import('./screens/settings');
    renderSettings(container);
  });

  router.register('#/help', async (container) => {
    const { renderHelp } = await import('./screens/help');
    renderHelp(container);
  });

  router.register('#/profile', async (container) => {
    const { renderProfileView } = await import('./screens/profile-view');
    renderProfileView(container);
  });

  router.register('#/history', async (container) => {
    const { renderHistory } = await import('./screens/history');
    renderHistory(container);
  });

  router.register('#/assessment/:moduleId/setup', async (container, params) => {
    const moduleId = params?.moduleId ?? '';
    const mod = moduleRegistry.getModule(moduleId);
    if (!mod) {
      router.navigate('#/menu');
      return;
    }
    if (moduleId.startsWith('grip')) {
      const { renderGripSetup } = await import('./modules/grip/grip-setup');
      renderGripSetup(container);
    } else {
      const { renderTappingSetup } = await import('./modules/tapping/tapping-setup');
      renderTappingSetup(container);
    }
  });

  router.register('#/assessment/:moduleId/instructions', async (container, params) => {
    const moduleId = params?.moduleId ?? '';
    if (moduleId.startsWith('grip')) {
      const { renderGripInstructions } = await import('./modules/grip/grip-instructions');
      renderGripInstructions(container);
    } else {
      const { renderTappingInstructions } = await import('./modules/tapping/tapping-instructions');
      renderTappingInstructions(container);
    }
  });

  router.register('#/assessment/:moduleId/practice', async (container, params) => {
    const moduleId = params?.moduleId ?? '';
    if (moduleId.startsWith('grip')) {
      const { renderGripPractice } = await import('./modules/grip/grip-practice');
      renderGripPractice(container);
    } else {
      const { renderTappingPractice } = await import('./modules/tapping/tapping-practice');
      renderTappingPractice(container);
    }
  });

  router.register('#/assessment/:moduleId/countdown', async (container, params) => {
    const moduleId = params?.moduleId ?? '';
    if (moduleId.startsWith('grip')) {
      const { renderGripCountdown } = await import('./modules/grip/grip-countdown');
      renderGripCountdown(container);
    } else {
      const { renderTappingCountdown } = await import('./modules/tapping/tapping-countdown');
      renderTappingCountdown(container);
    }
  });

  router.register('#/assessment/:moduleId/active', async (container, params) => {
    const moduleId = params?.moduleId ?? '';
    if (moduleId.startsWith('grip')) {
      const { renderGripActive } = await import('./modules/grip/grip-active');
      renderGripActive(container);
    } else {
      const { renderTappingActive } = await import('./modules/tapping/tapping-active');
      renderTappingActive(container);
    }
  });

  router.register('#/assessment/:moduleId/results', async (container, params) => {
    const moduleId = params?.moduleId ?? '';
    if (moduleId.startsWith('grip')) {
      const { renderGripResults } = await import('./modules/grip/grip-results');
      renderGripResults(container);
    } else {
      const { renderTappingResults } = await import('./modules/tapping/tapping-results');
      renderTappingResults(container);
    }
  });

  // Set app container and start router
  router.setContainer(app);

  // Always start at splash on fresh page load — splash handles routing
  // to menu (if profile exists) or consent (if new user).
  // This prevents stale hash fragments (e.g. #/help) from persisting
  // when the app is launched from a home screen shortcut.
  window.location.hash = '#/splash';

  router.start();

  // Register service worker
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      reg.addEventListener('updatefound', () => {
        eventBus.emit('sw-update-found', reg);
      });
    } catch (err) {
      console.error('SW registration failed:', err);
    }
  }
}

bootstrap();
