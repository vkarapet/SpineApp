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

export type RawSessionData = RawTapEvent[];

export interface ComputedMetrics {
  tap_count: number;
  frequency_hz: number;
  rhythm_cv: number;
  accuracy_mean_dist_px: number;
  accuracy_pct_in_target: number;
  duration_actual_ms: number;
  [key: string]: number;
}

export interface RedcapMapping {
  instrument: string;
  fieldMap: Record<string, string>;
}

export interface AssessmentModule {
  id: string;
  name: string;
  version: string;
  description: string;
  redcap: RedcapMapping;
  metrics: MetricConfig[];
  dbSchema?: (db: IDBDatabase) => void;
  getInstructions(): InstructionConfig;
  getPracticeConfig?(): PracticeConfig;
  createUI(container: HTMLElement): void;
  start(): void;
  stop(): RawSessionData;
  computeMetrics(rawData: RawSessionData): ComputedMetrics;
  getSessionMetadataFields?(): MetadataField[];
}
