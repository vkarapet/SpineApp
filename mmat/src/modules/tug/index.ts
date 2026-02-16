import type { AssessmentModule, RawSessionData, ComputedMetrics, InstructionConfig, MetadataField } from '../../types/assessment';
import type { AssessmentResult } from '../../types/db-schemas';
import { computeTugMetrics, getClinicalBand, getClinicalLabel } from './tug-metrics';
import { renderTugSetup } from './tug-setup';
import { renderTugInstructions } from './tug-instructions';
import { renderTugPractice } from './tug-practice';
import { renderTugCountdown } from './tug-countdown';
import { renderTugActive } from './tug-active';
import { renderTugResults } from './tug-results';

const WALKING_AID_LABELS: Record<string, string> = {
  none: 'no aid',
  cane: 'cane',
  walker: 'walker',
  other: 'other aid',
};

export const tugModule: AssessmentModule = {
  id: 'tug_v1',
  name: 'Timed Up & Go',
  version: '1.0.0',
  description: 'Measure functional mobility with a timed walk test',

  screens: {
    setup: renderTugSetup,
    instructions: renderTugInstructions,
    practice: renderTugPractice,
    countdown: renderTugCountdown,
    active: renderTugActive,
    results: renderTugResults,
  },

  redcap: {
    instrument: 'tug_task',
    fieldMap: {
      local_uuid: 'local_uuid',
      timestamp_start: 'tug_timestamp',
      'computed_metrics.duration_actual_ms': 'tug_duration',
      'computed_metrics.tug_time_s': 'tug_time',
      'session_metadata.fatigue_rating': 'tug_fatigue',
      'session_metadata.medication_taken': 'tug_medication',
      'session_metadata.walking_aid': 'tug_walking_aid',
      'session_metadata.test_mode': 'tug_test_mode',
      flagged: 'tug_flagged',
      flag_reason: 'tug_flag_reason',
      raw_data: 'tug_raw_json',
      checksum: 'tug_checksum',
      device_id: 'device_id',
      'session_metadata.device_os': 'device_os',
      'session_metadata.screen_width_px': 'screen_width',
      'session_metadata.screen_height_px': 'screen_height',
      'session_metadata.app_version': 'app_version',
    },
  },

  metrics: [
    { key: 'tug_time_s', label: 'TUG Time', unit: 's', higherIsBetter: false },
  ],

  getInstructions(): InstructionConfig {
    return {
      title: 'Timed Up & Go',
      body: 'A helper will time you as you stand, walk 3 meters, turn around, walk back, and sit down.',
      importantPoints: [
        'Start seated in a chair with your back against the chair',
        'Walk at a comfortable, safe pace',
        'A helper will tap Start and Stop on the phone',
        'You may use a walking aid if needed',
      ],
      showMeHow: false,
    };
  },

  createUI(_container: HTMLElement): void {
    // UI is created by the individual screen components
  },

  start(): void {
    // Started by tug-active.ts
  },

  stop(): RawSessionData {
    return [];
  },

  computeMetrics(rawData: RawSessionData): ComputedMetrics {
    return computeTugMetrics(rawData);
  },

  getSessionMetadataFields(): MetadataField[] {
    return [
      {
        key: 'walking_aid',
        label: 'Walking aid used?',
        type: 'radio',
        options: [
          { value: 'none', label: 'None' },
          { value: 'cane', label: 'Cane' },
          { value: 'walker', label: 'Walker' },
          { value: 'other', label: 'Other' },
        ],
      },
      {
        key: 'fatigue_rating',
        label: 'How are you feeling right now?',
        type: 'scale',
        min: 1,
        max: 5,
      },
    ];
  },

  getPrimaryMetric() {
    return { key: 'tug_time_s', label: 'Time', unit: 's', higherIsBetter: false };
  },

  getHistorySummary(result: AssessmentResult): string {
    const m = result.computed_metrics;
    const timeS = m.tug_time_s ?? 0;
    const band = getClinicalBand(timeS);
    const bandLabel = getClinicalLabel(band);
    const aid = WALKING_AID_LABELS[result.session_metadata.walking_aid ?? 'none'] ?? 'no aid';
    return `${timeS.toFixed(1)}s \u2022 ${bandLabel} \u2022 ${aid}`;
  },

  getSparklineValue(result: AssessmentResult): number {
    return result.computed_metrics.tug_time_s ?? 0;
  },
};
