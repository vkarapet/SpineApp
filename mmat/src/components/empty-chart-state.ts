import { createElement } from '../utils/dom';

export function createEmptyChartState(pointCount: number): HTMLElement {
  const container = createElement('div', { className: 'empty-chart-state' });

  if (pointCount === 0) {
    container.innerHTML = `
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
      <p>Complete your first assessment to see your progress here.</p>
    `;
  }

  return container;
}

const style = document.createElement('style');
style.textContent = `
  .empty-chart-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-3);
    padding: var(--space-8) var(--space-4);
    text-align: center;
    color: var(--color-text-disabled);
  }
  .empty-chart-state p {
    font-size: var(--font-size-sm);
  }
`;
document.head.appendChild(style);
