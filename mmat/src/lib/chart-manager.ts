import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  TimeScale,
  Tooltip,
  Legend,
  Filler,
  type ChartConfiguration,
  type ChartData,
} from 'chart.js';
import 'chartjs-adapter-date-fns';

// Register Chart.js components
Chart.register(
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  TimeScale,
  Tooltip,
  Legend,
  Filler,
);

export interface ChartDataPoint {
  x: Date;
  y: number;
  label?: string;
  hand?: string;
  isRestored?: boolean;
  isFlagged?: boolean;
}

export interface ChartConfig {
  canvas: HTMLCanvasElement;
  data: ChartDataPoint[];
  yAxisLabel: string;
  higherIsBetter: boolean;
}

export class ChartManager {
  private chart: Chart | null = null;

  create(config: ChartConfig): Chart {
    if (this.chart) {
      this.chart.destroy();
    }

    const { canvas, data, yAxisLabel, higherIsBetter } = config;

    // Separate local vs restored data
    const localData = data.filter((d) => !d.isRestored);
    const restoredData = data.filter((d) => d.isRestored);

    const chartData: ChartData<'line'> = {
      datasets: [
        {
          label: 'This device',
          data: localData.map((d) => ({ x: d.x.getTime(), y: d.y })),
          borderColor: '#1A73E8',
          backgroundColor: 'rgba(26, 115, 232, 0.1)',
          pointBackgroundColor: localData.map((d) =>
            d.isFlagged ? '#9AA0A6' : '#1A73E8',
          ),
          pointBorderColor: localData.map((d) =>
            d.isFlagged ? '#9AA0A6' : '#1A73E8',
          ),
          pointRadius: 5,
          pointHitRadius: 20,
          tension: 0.1,
          fill: false,
        },
        ...(restoredData.length > 0
          ? [
              {
                label: 'Restored from server',
                data: restoredData.map((d) => ({ x: d.x.getTime(), y: d.y })),
                borderColor: '#FF6D00',
                backgroundColor: 'rgba(255, 109, 0, 0.1)',
                pointBackgroundColor: '#FFFFFF',
                pointBorderColor: '#FF6D00',
                pointBorderWidth: 2,
                pointRadius: 5,
                pointHitRadius: 20,
                tension: 0.1,
                fill: false,
              },
            ]
          : []),
      ],
    };

    const chartConfig: ChartConfiguration<'line'> = {
      type: 'line',
      data: chartData,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'nearest',
          intersect: true,
        },
        plugins: {
          tooltip: {
            callbacks: {
              title: (items) => {
                if (items.length === 0) return '';
                const date = new Date(items[0].parsed.x as number);
                return date.toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                });
              },
              label: (item) => {
                const idx = item.dataIndex;
                const allData = [...localData, ...restoredData].sort(
                  (a, b) => a.x.getTime() - b.x.getTime(),
                );
                const point = allData[idx];
                const hand = point?.hand ? ` (${point.hand} hand)` : '';
                return `${(item.parsed.y ?? 0).toFixed(1)} ${yAxisLabel}${hand}`;
              },
            },
          },
          legend: {
            display: restoredData.length > 0,
            position: 'bottom',
            labels: {
              usePointStyle: true,
              font: { size: 12 },
            },
          },
        },
        scales: {
          x: {
            type: 'time',
            time: {
              unit: 'day',
              displayFormats: {
                day: 'MMM d',
              },
            },
            ticks: {
              maxTicksLimit: 6,
              font: { size: 12 },
            },
          },
          y: {
            title: {
              display: true,
              text: `${yAxisLabel} ${higherIsBetter ? '\u2191 Higher is better' : '\u2193 Lower is better'}`,
              font: { size: 12 },
            },
            beginAtZero: false,
            ticks: {
              font: { size: 12 },
            },
          },
        },
      },
    };

    this.chart = new Chart(canvas, chartConfig);
    return this.chart;
  }

  update(data: ChartDataPoint[]): void {
    if (!this.chart) return;

    const localData = data.filter((d) => !d.isRestored);
    const restoredData = data.filter((d) => d.isRestored);

    this.chart.data.datasets[0].data = localData.map((d) => ({ x: d.x.getTime(), y: d.y }));
    if (this.chart.data.datasets[1]) {
      this.chart.data.datasets[1].data = restoredData.map((d) => ({
        x: d.x.getTime(),
        y: d.y,
      }));
    }

    this.chart.update();
  }

  destroy(): void {
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }
  }

  getAccessibleSummary(data: ChartDataPoint[], metricLabel: string): string {
    if (data.length === 0) return 'No data available.';

    const nonFlagged = data.filter((d) => !d.isFlagged);
    const values = nonFlagged.map((d) => d.y);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const trend =
      values.length >= 3
        ? values[values.length - 1] > values[0]
          ? 'trending upward'
          : values[values.length - 1] < values[0]
            ? 'trending downward'
            : 'stable'
        : '';

    return `Line chart showing ${metricLabel} over ${data.length} sessions. Average: ${avg.toFixed(1)}. ${trend ? `Currently ${trend}.` : ''}`;
  }
}
