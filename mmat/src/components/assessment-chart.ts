import { createElement } from '../utils/dom';
import { ChartManager, type ChartDataPoint } from '../lib/chart-manager';
import { getChartData, getSessionCount } from '../services/visualization-service';
import { moduleRegistry } from '../main';

export interface AssessmentChartConfig {
  moduleId: string;
  deviceFilter: 'all' | 'this';
}

export async function createAssessmentChart(config: AssessmentChartConfig): Promise<HTMLElement> {
  const { moduleId, deviceFilter } = config;
  const container = createElement('div', { className: 'assessment-chart' });

  const mod = moduleRegistry.getModule(moduleId);
  const metrics = mod?.metrics ?? [];
  const defaultMetric = metrics[0]?.key ?? 'frequency_hz';

  const count = await getSessionCount();

  if (count === 0) {
    // Empty state
    container.innerHTML = `
      <div class="assessment-chart__empty">
        <svg width="48" height="48" viewBox="-1 -1 26 26" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
        </svg>
        <p>Complete your first assessment to see your progress here.</p>
      </div>
    `;
    return container;
  }

  // Metric selector
  const selectorContainer = createElement('div', { className: 'assessment-chart__selector' });
  const select = createElement('select', {
    className: 'assessment-chart__select',
    'aria-label': 'Select metric',
  });

  for (const metric of metrics) {
    const option = createElement('option', { textContent: metric.label });
    option.value = metric.key;
    select.appendChild(option);
  }

  selectorContainer.appendChild(select);
  container.appendChild(selectorContainer);

  // Chart canvas wrapper (for horizontal scroll)
  const chartWrapper = createElement('div', { className: 'assessment-chart__wrapper' });
  const canvas = createElement('canvas', {});
  canvas.width = 400;
  canvas.height = 250;
  chartWrapper.appendChild(canvas);
  container.appendChild(chartWrapper);

  // Data table link
  const tableLink = createElement('button', {
    className: 'assessment-chart__table-link',
    textContent: 'View as Table',
    'aria-label': 'View data as accessible table',
  });
  container.appendChild(tableLink);

  // Create chart
  const chartManager = new ChartManager();
  const data = await getChartData(moduleId.replace(/_v\d+$/, ''), defaultMetric, deviceFilter);

  const currentMetric = metrics.find((m) => m.key === defaultMetric);
  if (data.length >= 1) {
    chartManager.create({
      canvas,
      data,
      yAxisLabel: currentMetric?.label ?? '',
      higherIsBetter: currentMetric?.higherIsBetter ?? true,
    });

    // Accessible summary
    const summary = chartManager.getAccessibleSummary(data, currentMetric?.label ?? '');
    canvas.setAttribute('aria-label', summary);
    canvas.setAttribute('role', 'img');
  } else {
    showSinglePointState(container, data);
  }

  // Metric selector change
  select.addEventListener('change', async () => {
    const selectedKey = select.value;
    const selectedMetric = metrics.find((m) => m.key === selectedKey);
    const newData = await getChartData(
      moduleId.replace(/_v\d+$/, ''),
      selectedKey,
      deviceFilter,
    );

    chartManager.create({
      canvas,
      data: newData,
      yAxisLabel: selectedMetric?.label ?? '',
      higherIsBetter: selectedMetric?.higherIsBetter ?? true,
    });
  });

  // Table link click
  tableLink.addEventListener('click', () => {
    showDataTable(container, data, currentMetric?.label ?? '');
  });

  return container;
}

function showSinglePointState(container: HTMLElement, data: ChartDataPoint[]): void {
  if (data.length === 1) {
    const statCard = createElement('div', { className: 'assessment-chart__stat-card' });
    statCard.innerHTML = `
      <p>Your first result: <strong>${data[0].y.toFixed(1)}</strong></p>
    `;
    container.appendChild(statCard);
  }
}

function showDataTable(container: HTMLElement, data: ChartDataPoint[], metricLabel: string): void {
  const existing = container.querySelector('.assessment-chart__table');
  if (existing) {
    existing.remove();
    return;
  }

  const table = createElement('table', { className: 'assessment-chart__table' });
  table.innerHTML = `
    <thead>
      <tr>
        <th>Date</th>
        <th>${metricLabel}</th>
        <th>Hand</th>
      </tr>
    </thead>
    <tbody>
      ${data
        .map(
          (d) => `
        <tr${d.isFlagged ? ' class="flagged"' : ''}>
          <td>${d.x.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</td>
          <td>${d.y.toFixed(1)}</td>
          <td>${d.hand ?? '-'}</td>
        </tr>
      `,
        )
        .join('')}
    </tbody>
  `;
  container.appendChild(table);
}

const style = document.createElement('style');
style.textContent = `
  .assessment-chart {
    border: 2px solid var(--color-border);
    border-radius: var(--radius-lg);
    overflow: hidden;
  }
  .assessment-chart__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-3);
    padding: var(--space-8) var(--space-4);
    text-align: center;
    color: var(--color-text-disabled);
  }
  .assessment-chart__selector {
    padding: var(--space-3) var(--space-4);
    border-bottom: 1px solid var(--color-border);
  }
  .assessment-chart__select {
    min-height: var(--tap-target-min);
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
    background: var(--color-bg);
    width: 100%;
  }
  .assessment-chart__wrapper {
    padding: var(--space-3);
    overflow-x: auto;
    min-height: 16rem;
  }
  .assessment-chart__wrapper canvas {
    min-width: 100%;
  }
  .assessment-chart__table-link {
    display: block;
    width: 100%;
    padding: var(--space-3);
    text-align: center;
    color: var(--color-primary);
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    border-top: 1px solid var(--color-border);
    background: none;
    border-left: none;
    border-right: none;
    border-bottom: none;
    cursor: pointer;
    min-height: var(--tap-target-min);
  }
  .assessment-chart__stat-card {
    padding: var(--space-4);
    text-align: center;
    font-size: var(--font-size-lg);
  }
  .assessment-chart__table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--font-size-sm);
  }
  .assessment-chart__table th,
  .assessment-chart__table td {
    padding: var(--space-2) var(--space-3);
    text-align: left;
    border-top: 1px solid var(--color-border);
  }
  .assessment-chart__table th {
    font-weight: var(--font-weight-semibold);
    background: var(--color-bg-secondary);
  }
  .assessment-chart__table .flagged {
    opacity: 0.5;
  }
`;
document.head.appendChild(style);
