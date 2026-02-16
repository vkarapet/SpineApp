import { createElement } from '../utils/dom';

export interface HeaderConfig {
  title?: string;
  showSettings?: boolean;
  showHelp?: boolean;
  showBack?: boolean;
  onSettings?: () => void;
  onHelp?: () => void;
  onBack?: () => void;
}

export function createHeader(config: HeaderConfig): HTMLElement {
  const {
    title = 'MMAT',
    showSettings = false,
    showHelp = false,
    showBack = false,
    onSettings,
    onHelp,
    onBack,
  } = config;

  const header = createElement('header', { className: 'app-header' });
  header.setAttribute('role', 'banner');

  const left = createElement('div', { className: 'app-header__left' });
  if (showBack && onBack) {
    const backBtn = createElement('button', {
      className: 'app-header__btn',
      'aria-label': 'Go back',
    });
    backBtn.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>`;
    backBtn.addEventListener('click', onBack);
    left.appendChild(backBtn);
  }

  const titleEl = createElement('h1', {
    className: 'app-header__title',
    textContent: title,
  });

  const right = createElement('div', { className: 'app-header__right' });

  if (showHelp && onHelp) {
    const helpBtn = createElement('button', {
      className: 'app-header__btn',
      'aria-label': 'Help',
    });
    helpBtn.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><circle cx="12" cy="17" r=".5" fill="currentColor"/></svg>`;
    helpBtn.addEventListener('click', onHelp);
    right.appendChild(helpBtn);
  }

  if (showSettings && onSettings) {
    const settingsBtn = createElement('button', {
      className: 'app-header__btn',
      'aria-label': 'Settings',
    });
    settingsBtn.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;
    settingsBtn.addEventListener('click', onSettings);
    right.appendChild(settingsBtn);
  }

  header.appendChild(left);
  header.appendChild(titleEl);
  header.appendChild(right);

  return header;
}

// Styles
const style = document.createElement('style');
style.textContent = `
  .app-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-3) var(--space-4);
    padding-top: calc(var(--space-3) + var(--safe-area-top));
    background: var(--color-bg);
    border-bottom: 1px solid var(--color-border);
    position: sticky;
    top: 0;
    z-index: var(--z-header);
  }
  .app-header__left,
  .app-header__right {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
  .app-header__title {
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-bold);
    color: var(--color-primary);
  }
  .app-header__btn {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: var(--tap-target-min);
    min-height: var(--tap-target-min);
    border-radius: var(--radius-full);
    color: var(--color-text-secondary);
    background: none;
    border: none;
    cursor: pointer;
  }
  .app-header__btn:active {
    background: var(--color-bg-secondary);
  }
`;
document.head.appendChild(style);
