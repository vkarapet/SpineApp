export interface MetricConfig {
  key: string;
  label: string;
  unit: string;
  higherIsBetter: boolean;
}

export interface InstructionConfig {
  title: string;
  body: string;
  importantPoints: string[];
  showMeHow: boolean;
}

export interface PracticeConfig {
  durationMs: number;
  showFeedback: boolean;
  showCounter: boolean;
}

export interface MetadataField {
  key: string;
  label: string;
  type: 'radio' | 'scale';
  options?: { value: string | number; label: string }[];
  min?: number;
  max?: number;
}

export interface RawTapEvent {
  t: number;
  x: number;
  y: number;
  type: 'start' | 'end';
  touch_id: number;
  rejected: boolean;
  reject_reason: string | null;
}

export interface RawMotionEvent {
  kind: 'motion';
  t: number;
  ax: number;
  ay: number;
  az: number;
  gx: number;
  gy: number;
  gz: number;
}

export interface RawTimerEvent {
  kind: 'timer';
  t: number;
  event: 'start' | 'stop' | 'lap';
  source: 'manual' | 'sensor';
}

/** Discriminated by presence of `kind` — legacy tap events have no `kind` field. */
export type RawEvent = RawTapEvent | RawMotionEvent | RawTimerEvent;

export type RawSessionData = RawEvent[];

/** Type guard: events without `kind` are legacy RawTapEvent records. */
export function isTapEvent(e: RawEvent): e is RawTapEvent {
  return !('kind' in e);
}

export function isMotionEvent(e: RawEvent): e is RawMotionEvent {
  return 'kind' in e && (e as RawMotionEvent).kind === 'motion';
}

export function isTimerEvent(e: RawEvent): e is RawTimerEvent {
  return 'kind' in e && (e as RawTimerEvent).kind === 'timer';
}

export interface ComputedMetrics {
  duration_actual_ms: number;
  [key: string]: number;
}

export interface RedcapMapping {
  instrument: string;
  fieldMap: Record<string, string>;
}

export type ScreenRenderer = (container: HTMLElement) => void | Promise<void>;

export interface AssessmentModule {
  id: string;
  name: string;
  version: string;
  description: string;
  redcap: RedcapMapping;
  metrics: MetricConfig[];

  /** Module-provided screen renderers, keyed by stage name. */
  screens?: Record<string, ScreenRenderer>;

  dbSchema?: (db: IDBDatabase) => void;
  getInstructions(): InstructionConfig;
  getPracticeConfig?(): PracticeConfig;
  createUI(container: HTMLElement): void;
  start(): void;
  stop(): RawSessionData;
  computeMetrics(rawData: RawSessionData): ComputedMetrics;
  getSessionMetadataFields?(): MetadataField[];

  /** Primary metric info for display (sparklines, result cards). */
  getPrimaryMetric(): { key: string; label: string; unit: string; higherIsBetter: boolean };

  /** One-line summary for history rows (e.g. "42 taps • 2.8 Hz • right"). */
  getHistorySummary(result: import('./db-schemas').AssessmentResult): string;

  /** Value to plot in sparkline charts. */
  getSparklineValue(result: import('./db-schemas').AssessmentResult): number;
}
