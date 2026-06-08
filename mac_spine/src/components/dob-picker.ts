import { createElement } from '../utils/dom';

/**
 * Three-select DOB picker — month / day / year.
 *
 * Why: native `<input type="date">` renders as a calendar grid on most
 * platforms, which is painful for older participants who'd otherwise
 * scroll month-by-month back to e.g. 1955. Three `<select>` elements
 * render as wheel pickers on iOS and as compact dropdowns on Android,
 * both of which beat the grid for far-back dates.
 *
 * getValue() returns an ISO date string (YYYY-MM-DD) or '' if any field
 * is empty / invalid.
 */
export interface DobPickerRef {
  container: HTMLDivElement;
  getValue: () => string;
  setValue: (iso: string) => void;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function createDobPicker(opts: { id: string; label: string; value?: string }): DobPickerRef {
  const container = createElement('div', { className: 'dob-picker' });
  const label = createElement('label', {
    className: 'dob-picker__label',
    textContent: opts.label,
  });
  container.appendChild(label);

  const row = createElement('div', { className: 'dob-picker__row' });

  const monthSel = createElement('select', { className: 'dob-picker__select dob-picker__month', id: `${opts.id}-month` });
  monthSel.appendChild(new Option('Month', ''));
  for (let i = 0; i < 12; i++) {
    monthSel.appendChild(new Option(MONTH_NAMES[i], String(i + 1)));
  }

  const daySel = createElement('select', { className: 'dob-picker__select dob-picker__day', id: `${opts.id}-day` });
  daySel.appendChild(new Option('Day', ''));

  const yearSel = createElement('select', { className: 'dob-picker__select dob-picker__year', id: `${opts.id}-year` });
  yearSel.appendChild(new Option('Year', ''));
  const thisYear = new Date().getFullYear();
  for (let y = thisYear; y >= 1900; y--) {
    yearSel.appendChild(new Option(String(y), String(y)));
  }

  // Day options depend on month/year — rebuild on change.
  function rebuildDays(): void {
    const m = parseInt(monthSel.value || '0', 10);
    const y = parseInt(yearSel.value || '0', 10) || thisYear;
    const maxDay = m > 0 ? new Date(y, m, 0).getDate() : 31;
    const prev = daySel.value;
    while (daySel.options.length > 1) daySel.remove(1);
    for (let d = 1; d <= maxDay; d++) {
      daySel.appendChild(new Option(String(d), String(d)));
    }
    if (prev && parseInt(prev, 10) <= maxDay) daySel.value = prev;
  }
  rebuildDays();

  monthSel.addEventListener('change', rebuildDays);
  yearSel.addEventListener('change', rebuildDays);

  row.appendChild(monthSel);
  row.appendChild(daySel);
  row.appendChild(yearSel);
  container.appendChild(row);

  function getValue(): string {
    const m = monthSel.value;
    const d = daySel.value;
    const y = yearSel.value;
    if (!m || !d || !y) return '';
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  function setValue(iso: string): void {
    if (!iso) return;
    const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return;
    yearSel.value = String(parseInt(match[1], 10));
    monthSel.value = String(parseInt(match[2], 10));
    rebuildDays();
    daySel.value = String(parseInt(match[3], 10));
  }

  if (opts.value) setValue(opts.value);

  return { container, getValue, setValue };
}

// Inject styles once.
if (typeof document !== 'undefined' && !document.getElementById('dob-picker-styles')) {
  const style = document.createElement('style');
  style.id = 'dob-picker-styles';
  style.textContent = `
    .dob-picker {
      display: flex; flex-direction: column; gap: var(--space-2);
      margin-bottom: var(--space-3);
    }
    .dob-picker__label {
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-medium);
      color: var(--color-text);
    }
    .dob-picker__row {
      display: grid;
      grid-template-columns: 1.4fr 0.8fr 1fr;
      gap: var(--space-2);
    }
    .dob-picker__select {
      width: 100%;
      padding: var(--space-3);
      font-size: var(--font-size-base);
      font-family: inherit;
      background: var(--color-bg);
      border: 1px solid var(--color-border, rgba(0,0,0,0.15));
      border-radius: var(--radius-md);
      color: var(--color-text);
      appearance: none;
      -webkit-appearance: none;
    }
    .dob-picker__select:focus {
      outline: 2px solid var(--color-primary);
      outline-offset: 2px;
    }
  `;
  document.head.appendChild(style);
}
