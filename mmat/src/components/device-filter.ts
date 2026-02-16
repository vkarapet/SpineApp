import { createElement } from '../utils/dom';

export function createDeviceFilter(
  currentFilter: 'all' | 'this',
  onChange: (filter: 'all' | 'this') => void,
): HTMLElement {
  const container = createElement('div', { className: 'device-filter' });
  container.setAttribute('role', 'group');
  container.setAttribute('aria-label', 'Device filter');

  const label = createElement('span', {
    className: 'device-filter__label',
    textContent: 'Show:',
  });

  const allBtn = createElement('button', {
    className: `device-filter__btn ${currentFilter === 'all' ? 'device-filter__btn--active' : ''}`,
    textContent: 'All Devices',
    'aria-pressed': currentFilter === 'all' ? 'true' : 'false',
  });

  const thisBtn = createElement('button', {
    className: `device-filter__btn ${currentFilter === 'this' ? 'device-filter__btn--active' : ''}`,
    textContent: 'This Device Only',
    'aria-pressed': currentFilter === 'this' ? 'true' : 'false',
  });

  allBtn.addEventListener('click', () => {
    allBtn.classList.add('device-filter__btn--active');
    allBtn.setAttribute('aria-pressed', 'true');
    thisBtn.classList.remove('device-filter__btn--active');
    thisBtn.setAttribute('aria-pressed', 'false');
    onChange('all');
  });

  thisBtn.addEventListener('click', () => {
    thisBtn.classList.add('device-filter__btn--active');
    thisBtn.setAttribute('aria-pressed', 'true');
    allBtn.classList.remove('device-filter__btn--active');
    allBtn.setAttribute('aria-pressed', 'false');
    onChange('this');
  });

  container.appendChild(label);
  container.appendChild(allBtn);
  container.appendChild(thisBtn);

  return container;
}

const style = document.createElement('style');
style.textContent = `
  .device-filter {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
  .device-filter__label {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
  }
  .device-filter__btn {
    min-height: var(--tap-target-min);
    padding: var(--space-2) var(--space-3);
    font-size: var(--font-size-sm);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-bg);
    cursor: pointer;
  }
  .device-filter__btn--active {
    background: var(--color-primary);
    color: #fff;
    border-color: var(--color-primary);
  }
`;
document.head.appendChild(style);
