import { createElement } from '../utils/dom';
import { formatDate } from '../utils/date';

export interface ModuleCardConfig {
  name: string;
  description: string;
  lastCompleted: string | null;
  sparklineValues: number[];
  onClick: () => void;
  locked?: boolean;
  lockedBadge?: string;
  lockedMessage?: string;
}

export function createModuleCard(config: ModuleCardConfig): HTMLElement {
  const { name, description, lastCompleted, sparklineValues, onClick, locked, lockedBadge, lockedMessage } = config;

  const card = createElement('button', {
    className: locked ? 'module-card module-card--locked' : 'module-card',
    'aria-label': locked ? `${name}: ${lockedBadge ?? 'Locked'} — tap to set up` : `Start ${name}`,
  });

  const content = createElement('div', { className: 'module-card__content' });
  const nameRow = createElement('div', { className: 'module-card__name-row' });
  nameRow.appendChild(createElement('h3', {
    className: 'module-card__name',
    textContent: name,
  }));
  if (locked && lockedBadge) {
    nameRow.appendChild(createElement('span', {
      className: 'module-card__badge',
      textContent: lockedBadge,
    }));
  }
  content.appendChild(nameRow);
  content.appendChild(createElement('p', {
    className: 'module-card__desc',
    textContent: locked && lockedMessage ? lockedMessage : description,
  }));

  if (lastCompleted) {
    content.appendChild(createElement('p', {
      className: 'module-card__last',
      textContent: `Last completed: ${formatDate(lastCompleted)}`,
    }));
  }

  // Sparkline
  if (sparklineValues.length >= 2) {
    content.appendChild(createSparkline(sparklineValues));
  } else if (sparklineValues.length === 0 && !lastCompleted) {
    content.appendChild(createElement('p', {
      className: 'module-card__empty',
      textContent: 'No sessions yet',
    }));
  }

  const arrow = createElement('div', { className: 'module-card__arrow' });
  arrow.innerHTML = `<svg width="24" height="24" viewBox="-1 -1 26 26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>`;

  card.appendChild(content);
  card.appendChild(arrow);
  card.addEventListener('click', onClick);

  return card;
}

function createSparkline(values: number[]): HTMLElement {
  const width = 120;
  const height = 32;
  const padding = 4;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = values.map((v, i) => {
    const x = padding + (i / (values.length - 1)) * (width - padding * 2);
    const y = height - padding - ((v - min) / range) * (height - padding * 2);
    return `${x},${y}`;
  }).join(' ');

  const container = createElement('div', { className: 'module-card__sparkline' });
  container.innerHTML = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" aria-hidden="true">
      <polyline points="${points}" fill="none" stroke="var(--color-primary, #7A003C)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="${points.split(' ').pop()!.split(',')[0]}" cy="${points.split(' ').pop()!.split(',')[1]}" r="3" fill="var(--color-primary, #7A003C)"/>
    </svg>
    <span class="module-card__sparkline-label">${values.length} sessions</span>
  `;

  return container;
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
    color: var(--color-primary);
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
  .module-card__empty {
    font-size: var(--font-size-xs);
    color: var(--color-text-disabled);
    margin-top: var(--space-1);
    font-style: italic;
  }
  .module-card__sparkline {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin-top: var(--space-2);
  }
  .module-card__sparkline-label {
    font-size: var(--font-size-xs);
    color: var(--color-text-disabled);
  }
  .module-card__arrow {
    color: var(--color-secondary);
    flex-shrink: 0;
  }
  .module-card--locked {
    opacity: 0.7;
    border-style: dashed;
  }
  .module-card--locked .module-card__name {
    color: var(--color-text-secondary);
  }
  .module-card__name-row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-wrap: wrap;
  }
  .module-card__badge {
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-semibold);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 2px var(--space-2);
    border-radius: var(--radius-full);
    background: var(--color-secondary);
    color: var(--color-text);
  }
`;
document.head.appendChild(style);
