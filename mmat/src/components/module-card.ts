import { createElement } from '../utils/dom';
import { formatDate } from '../utils/date';

export interface ModuleCardConfig {
  name: string;
  description: string;
  lastCompleted: string | null;
  onClick: () => void;
}

export function createModuleCard(config: ModuleCardConfig): HTMLElement {
  const { name, description, lastCompleted, onClick } = config;

  const card = createElement('button', {
    className: 'module-card',
    'aria-label': `Start ${name}`,
  });

  const content = createElement('div', { className: 'module-card__content' });
  content.appendChild(createElement('h3', {
    className: 'module-card__name',
    textContent: name,
  }));
  content.appendChild(createElement('p', {
    className: 'module-card__desc',
    textContent: description,
  }));

  if (lastCompleted) {
    content.appendChild(createElement('p', {
      className: 'module-card__last',
      textContent: `Last completed: ${formatDate(lastCompleted)}`,
    }));
  }

  const arrow = createElement('div', { className: 'module-card__arrow' });
  arrow.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>`;

  card.appendChild(content);
  card.appendChild(arrow);
  card.addEventListener('click', onClick);

  return card;
}

const style = document.createElement('style');
style.textContent = `
  .module-card {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    width: 100%;
    padding: var(--space-4);
    background: var(--color-bg);
    border: 2px solid var(--color-border);
    border-radius: var(--radius-lg);
    cursor: pointer;
    text-align: left;
    min-height: var(--tap-target-preferred);
  }
  .module-card:active {
    background: var(--color-bg-secondary);
    border-color: var(--color-primary);
  }
  .module-card + .module-card {
    margin-top: var(--space-2);
  }
  .module-card__content {
    flex: 1;
  }
  .module-card__name {
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-semibold);
  }
  .module-card__desc {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    margin-top: var(--space-1);
  }
  .module-card__last {
    font-size: var(--font-size-xs);
    color: var(--color-text-disabled);
    margin-top: var(--space-1);
  }
  .module-card__arrow {
    color: var(--color-text-disabled);
    flex-shrink: 0;
  }
`;
document.head.appendChild(style);
