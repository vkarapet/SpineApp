import { Router } from './core/router';
import { initDB } from './core/db';
import { EventBus } from './core/event-bus';
import { ModuleRegistry } from './core/module-registry';
import { initConnectivityService } from './services/connectivity-service';
import { renderSplash } from './screens/splash';

export const router = new Router();
export const eventBus = new EventBus();
export const moduleRegistry = new ModuleRegistry();

async function registerModules(): Promise<void> {
  const [tapping, grip, tug] = await Promise.all([
    import('./modules/tapping/index'),
    import('./modules/grip/index'),
    import('./modules/tug/index'),
  ]);
  moduleRegistry.register(tapping.tappingModule);
  moduleRegistry.register(grip.gripModule);
  moduleRegistry.register(tug.tugModule);
}

async function bootstrap() {
  try {
    await initDB();
  } catch (err) {
    console.error('Failed to initialize database:', err);
  }

  // Register all assessment modules before routing
  try {
    await registerModules();
  } catch (err) {
    console.error('Failed to register modules:', err);
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
    if (mod.screens?.setup) {
      await mod.screens.setup(container);
    } else if (moduleId.startsWith('grip')) {
      const { renderGripSetup } = await import('./modules/grip/grip-setup');
      renderGripSetup(container);
    } else {
      const { renderTappingSetup } = await import('./modules/tapping/tapping-setup');
      renderTappingSetup(container);
    }
  });

  router.register('#/assessment/:moduleId/instructions', async (container, params) => {
    const moduleId = params?.moduleId ?? '';
    const mod = moduleRegistry.getModule(moduleId);
    if (mod?.screens?.instructions) {
      await mod.screens.instructions(container);
    } else if (moduleId.startsWith('grip')) {
      const { renderGripInstructions } = await import('./modules/grip/grip-instructions');
      renderGripInstructions(container);
    } else {
      const { renderTappingInstructions } = await import('./modules/tapping/tapping-instructions');
      renderTappingInstructions(container);
    }
  });

  router.register('#/assessment/:moduleId/practice', async (container, params) => {
    const moduleId = params?.moduleId ?? '';
    const mod = moduleRegistry.getModule(moduleId);
    if (mod?.screens?.practice) {
      await mod.screens.practice(container);
    } else if (moduleId.startsWith('grip')) {
      const { renderGripPractice } = await import('./modules/grip/grip-practice');
      renderGripPractice(container);
    } else {
      const { renderTappingPractice } = await import('./modules/tapping/tapping-practice');
      renderTappingPractice(container);
    }
  });

  router.register('#/assessment/:moduleId/countdown', async (container, params) => {
    const moduleId = params?.moduleId ?? '';
    const mod = moduleRegistry.getModule(moduleId);
    if (mod?.screens?.countdown) {
      await mod.screens.countdown(container);
    } else if (moduleId.startsWith('grip')) {
      const { renderGripCountdown } = await import('./modules/grip/grip-countdown');
      renderGripCountdown(container);
    } else {
      const { renderTappingCountdown } = await import('./modules/tapping/tapping-countdown');
      renderTappingCountdown(container);
    }
  });

  router.register('#/assessment/:moduleId/active', async (container, params) => {
    const moduleId = params?.moduleId ?? '';
    const mod = moduleRegistry.getModule(moduleId);
    if (mod?.screens?.active) {
      await mod.screens.active(container);
    } else if (moduleId.startsWith('grip')) {
      const { renderGripActive } = await import('./modules/grip/grip-active');
      renderGripActive(container);
    } else {
      const { renderTappingActive } = await import('./modules/tapping/tapping-active');
      renderTappingActive(container);
    }
  });

  router.register('#/assessment/:moduleId/results', async (container, params) => {
    const moduleId = params?.moduleId ?? '';
    const mod = moduleRegistry.getModule(moduleId);
    if (mod?.screens?.results) {
      await mod.screens.results(container);
    } else if (moduleId.startsWith('grip')) {
      const { renderGripResults } = await import('./modules/grip/grip-results');
      renderGripResults(container);
    } else {
      const { renderTappingResults } = await import('./modules/tapping/tapping-results');
      renderTappingResults(container);
    }
  });

  // Generic route handler for modules that provide their own screens.
  // Registered AFTER the static routes above, so existing tapping/grip routes
  // take priority. New modules (e.g. TUG) use this via their `screens` map.
  router.register('#/assessment/:moduleId/:stage', async (container, params) => {
    const moduleId = params?.moduleId ?? '';
    const stage = params?.stage ?? '';
    const mod = moduleRegistry.getModule(moduleId);
    if (!mod?.screens?.[stage]) {
      router.navigate('#/menu');
      return;
    }
    await mod.screens[stage](container);
  });

  // Start connectivity monitoring (auto-syncs when coming back online)
  initConnectivityService();

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
    const base = import.meta.env.BASE_URL;
    try {
      const reg = await navigator.serviceWorker.register(base + 'sw.js', { scope: base });
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          // New SW installed and waiting — prompt user to update
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            import('./components/toast').then(({ showToast }) => {
              const toast = showToast('New version available — tap to update', 'info', false);
              toast.style.cursor = 'pointer';
              toast.addEventListener('click', () => {
                newWorker.postMessage({ type: 'SKIP_WAITING' });
                toast.remove();
              });
            });
          }
        });
      });
      // Reload when the new SW takes over
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload();
      });
    } catch (err) {
      console.error('SW registration failed:', err);
    }
  }
}

bootstrap();
