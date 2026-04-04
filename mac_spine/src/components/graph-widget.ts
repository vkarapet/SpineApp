import { createElement } from '../utils/dom';

export function createGraphWidget(): HTMLElement {
  const container = createElement('div', { className: 'graph-widget' });

  // Placeholder for chart — will be replaced in Phase 6
  const placeholder = createElement('div', { className: 'graph-widget__empty' });
  placeholder.innerHTML = `
    <svg width="48" height="48" viewBox="-1 -1 26 26" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
    <p>Complete your first assessment to see your progress here.</p>
  `;
  placeholder.setAttribute('role', 'img');
  placeholder.setAttribute('aria-label', 'No assessment data yet');

  container.appendChild(placeholder);
  return container;
}

const style = document.createElement('style');
style.textContent = `
  .graph-widget {
    border: 2px solid var(--color-border);
    border-radius: var(--radius-lg);
    overflow: hidden;
    min-height: 12rem;
  }
  .graph-widget__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-3);
    padding: var(--space-8) var(--space-4);
    text-align: center;
    color: var(--color-text-disabled);
  }
  .graph-widget__empty p {
    font-size: var(--font-size-sm);
    max-width: 20rem;
  }
`;
document.head.appendChild(style);
