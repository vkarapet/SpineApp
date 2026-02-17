import type { AssessmentModule, RawSessionData, ComputedMetrics, InstructionConfig, MetadataField } from '../../types/assessment';
import { isMotionEvent } from '../../types/assessment';
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
      flagged: 'tug_flagged',
      flag_reason: 'tug_flag_reason',
      raw_data: 'tug_raw_json',
      checksum: 'tug_checksum',
      device_id: 'device_id',
      'session_metadata.device_os': 'device_os',
      'session_metadata.screen_width_px': 'screen_width',
      'session_metadata.screen_height_px': 'screen_height',
      'session_metadata.app_version': 'app_version',
      // Sensor metrics
      'computed_metrics.total_steps': 'tug_total_steps',
      'computed_metrics.total_distance_m': 'tug_total_distance',
      'computed_metrics.avg_stride_length_m': 'tug_avg_stride',
      'computed_metrics.walk_out_steps': 'tug_walk_out_steps',
      'computed_metrics.walk_out_distance_m': 'tug_walk_out_distance',
      'computed_metrics.walk_out_duration_ms': 'tug_walk_out_duration',
      'computed_metrics.walk_back_steps': 'tug_walk_back_steps',
      'computed_metrics.walk_back_distance_m': 'tug_walk_back_distance',
      'computed_metrics.walk_back_duration_ms': 'tug_walk_back_duration',
      'computed_metrics.turn_out_yaw_deg': 'tug_turn_out_yaw',
      'computed_metrics.turn_out_duration_ms': 'tug_turn_out_duration',
      'computed_metrics.turn_sit_yaw_deg': 'tug_turn_sit_yaw',
      'computed_metrics.turn_sit_duration_ms': 'tug_turn_sit_duration',
      'computed_metrics.standup_duration_ms': 'tug_standup_duration',
      'computed_metrics.sitdown_duration_ms': 'tug_sitdown_duration',
      'computed_metrics.phases_completed': 'tug_phases_completed',
    },
  },

  metrics: [
    { key: 'tug_time_s', label: 'TUG Time', unit: 's', higherIsBetter: false },
    { key: 'total_steps', label: 'Total Steps', unit: '', higherIsBetter: false },
    { key: 'total_distance_m', label: 'Total Distance', unit: 'm', higherIsBetter: false },
    { key: 'avg_stride_length_m', label: 'Avg Stride', unit: 'm', higherIsBetter: false },
    { key: 'standup_duration_ms', label: 'Stand Up Time', unit: 'ms', higherIsBetter: false },
    { key: 'sitdown_duration_ms', label: 'Sit Down Time', unit: 'ms', higherIsBetter: false },
  ],

  getInstructions(): InstructionConfig {
    return {
      title: 'Timed Up & Go',
      body: 'The phone goes in your pocket and automatically detects each phase of the walk test.',
      importantPoints: [
        'Place the phone in your front trouser pocket',
        'Start seated in a chair with your back against the chair',
        'Sit still — the test starts automatically after 3 seconds',
        'Walk at a comfortable, safe pace',
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
    // If there are motion events, use sensor metrics computation
    const hasMotion = rawData.some(isMotionEvent);
    if (hasMotion) {
      // For recomputation from raw data only (no live phase data),
      // fall back to base timing metrics
      return computeTugMetrics(rawData);
    }
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

    let summary = `${timeS.toFixed(1)}s \u2022 ${bandLabel} \u2022 ${aid}`;
    if (m.total_steps) {
      summary += ` \u2022 ${m.total_steps} steps`;
    }
    return summary;
  },

  getSparklineValue(result: AssessmentResult): number {
    return result.computed_metrics.tug_time_s ?? 0;
  },
};
