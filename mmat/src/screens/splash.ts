import { clearContainer, createElement } from '../utils/dom';
import { startOnboarding } from '../services/onboarding-service';

export function renderSplash(container: HTMLElement): void {
  clearContainer(container);

  const wrapper = createElement('main', {
    className: 'splash-screen',
  });
  wrapper.setAttribute('role', 'main');

  const logo = createElement('div', { className: 'splash-screen__logo' });
  const logoImg = createElement('img') as HTMLImageElement;
  logoImg.src = '/icons/icon-192.png';
  logoImg.width = 96;
  logoImg.height = 96;
  logoImg.alt = '';
  logoImg.setAttribute('aria-hidden', 'true');
  logo.appendChild(logoImg);

  const title = createElement('h1', {
    className: 'splash-screen__title',
    textContent: 'Mobile Modular Assessment Tool',
  });

  const subtitle = createElement('p', {
    className: 'splash-screen__subtitle',
    textContent: 'MMAT',
  });

  const spinner = createElement('div', { className: 'spinner' });

  const status = createElement('p', {
    className: 'splash-screen__status',
    textContent: 'Initializing...',
  });
  status.setAttribute('aria-live', 'polite');

  wrapper.appendChild(logo);
  wrapper.appendChild(title);
  wrapper.appendChild(subtitle);
  wrapper.appendChild(spinner);
  wrapper.appendChild(status);
  container.appendChild(wrapper);

  // Check if offline on first visit
  if (!navigator.onLine && !('serviceWorker' in navigator && navigator.serviceWorker.controller)) {
    status.textContent =
      'This app requires an internet connection for first-time setup. Please connect and try again.';
    spinner.style.display = 'none';
    return;
  }

  // Delay for splash display, then determine route
  setTimeout(async () => {
    status.textContent = 'Loading...';
    await startOnboarding();
  }, 800);
}

// Inject splash styles
const style = document.createElement('style');
style.textContent = `
  .splash-screen {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    min-height: 100dvh;
    padding: var(--space-8);
    text-align: center;
    gap: var(--space-4);
  }
  .splash-screen__logo {
    margin-bottom: var(--space-4);
  }
  .splash-screen__title {
    font-size: var(--font-size-2xl);
    font-weight: var(--font-weight-bold);
    color: var(--color-primary);
  }
  .splash-screen__subtitle {
    font-size: var(--font-size-base);
    color: var(--color-text-secondary);
  }
  .splash-screen__status {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    margin-top: var(--space-4);
  }
`;
document.head.appendChild(style);
