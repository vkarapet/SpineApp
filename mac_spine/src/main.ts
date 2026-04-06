import { Router } from './core/router';
import { initDB } from './core/db';
import { EventBus } from './core/event-bus';
import { ModuleRegistry } from './core/module-registry';
import { initConnectivityService } from './services/connectivity-service';
import { initInstallService } from './services/install-service';
import { renderSplash } from './screens/splash';

export const router = new Router();
export const eventBus = new EventBus();
export const moduleRegistry = new ModuleRegistry();

/** SW registration — available after bootstrap for manual update checks. */
export let swRegistration: ServiceWorkerRegistration | null = null;

function promptSwUpdate(worker: ServiceWorker): void {
  import('./components/toast').then(({ showToast }) => {
    const toast = showToast('New version available — tap to update', 'info', false);
    toast.style.cursor = 'pointer';
    toast.addEventListener('click', () => {
      worker.postMessage({ type: 'SKIP_WAITING' });
      toast.remove();
    });
  });
}

async function registerModules(): Promise<void> {
  const [grip, tug] = await Promise.all([
    import('./modules/grip/index'),
    import('./modules/tug/index'),
  ]);
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

  // All assessment modules provide their screens via the `screens` map.
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

  // Capture install prompt for PWA install button
  initInstallService();

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

      // Expose registration for settings screen "Check for Updates"
      swRegistration = reg;

      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          // New SW installed and waiting — prompt user to update
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            promptSwUpdate(newWorker);
          }
        });
      });

      // Reload when the new SW takes over
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload();
      });

      // Check for updates when the app returns to foreground
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          reg.update().catch(() => {});
        }
      });

      // Also check if there's already a waiting worker (dismissed toast earlier)
      if (reg.waiting && navigator.serviceWorker.controller) {
        promptSwUpdate(reg.waiting);
      }
    } catch (err) {
      console.error('SW registration failed:', err);
    }
  }
}

bootstrap();
