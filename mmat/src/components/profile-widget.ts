import { createElement } from '../utils/dom';

export function createProfileWidget(
  name: string,
  onClick: () => void,
): HTMLElement {
  const widget = createElement('button', {
    className: 'profile-widget',
    'aria-label': `Profile: ${name}. Tap to view profile.`,
  });

  widget.innerHTML = `
    <div class="profile-widget__avatar">${name.charAt(0).toUpperCase()}</div>
    <span class="profile-widget__name">Hi, ${escapeHtml(name)}</span>
    <svg class="profile-widget__chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
  `;

  widget.addEventListener('click', onClick);
  return widget;
}

function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

const style = document.createElement('style');
style.textContent = `
  .profile-widget {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
    background: var(--color-bg-secondary);
    border-radius: var(--radius-lg);
    border: none;
    cursor: pointer;
    width: 100%;
    min-height: var(--tap-target-preferred);
    text-align: left;
  }
  .profile-widget:active {
    background: var(--color-bg-tertiary);
  }
  .profile-widget__avatar {
    width: 2.5rem;
    height: 2.5rem;
    border-radius: var(--radius-full);
    background: var(--color-primary);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: var(--font-weight-bold);
    font-size: var(--font-size-lg);
    flex-shrink: 0;
  }
  .profile-widget__name {
    flex: 1;
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-medium);
  }
  .profile-widget__chevron {
    color: var(--color-text-disabled);
    flex-shrink: 0;
  }
`;
document.head.appendChild(style);
