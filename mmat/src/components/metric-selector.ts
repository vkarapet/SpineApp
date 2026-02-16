import { createElement } from '../utils/dom';
import type { MetricConfig } from '../types/assessment';

export function createMetricSelector(
  metrics: MetricConfig[],
  currentKey: string,
  onChange: (key: string) => void,
): HTMLElement {
  const container = createElement('div', { className: 'metric-selector' });

  const label = createElement('label', {
    className: 'metric-selector__label',
    textContent: 'Metric:',
  });
  label.setAttribute('for', 'metric-select');

  const select = createElement('select', {
    id: 'metric-select',
    className: 'metric-selector__select',
    'aria-label': 'Select metric to display',
  });

  for (const metric of metrics) {
    const option = createElement('option', {
      textContent: `${metric.label} ${metric.higherIsBetter ? '\u2191' : '\u2193'}`,
    });
    option.value = metric.key;
    if (metric.key === currentKey) option.selected = true;
    select.appendChild(option);
  }

  select.addEventListener('change', () => {
    onChange(select.value);
  });

  container.appendChild(label);
  container.appendChild(select);
  return container;
}

const style = document.createElement('style');
style.textContent = `
  .metric-selector {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
  .metric-selector__label {
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    color: var(--color-text-secondary);
    white-space: nowrap;
  }
  .metric-selector__select {
    min-height: var(--tap-target-min);
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
    background: var(--color-bg);
    flex: 1;
  }
`;
document.head.appendChild(style);
