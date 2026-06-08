import type { AssessmentModule, RawSessionData, ComputedMetrics, InstructionConfig, MetadataField } from '../../types/assessment';
import type { AssessmentResult } from '../../types/db-schemas';
import { computeTugMetrics, getClinicalBand, getClinicalLabel } from './tug-metrics';
import { WALKING_AID_LABELS } from './tug-types';
import { renderTugSetup } from './tug-setup';
import { renderTugInstructions } from './tug-instructions';
import { renderTugPractice } from './tug-practice';
import { renderTugCountdown } from './tug-countdown';
import { renderTugActive } from './tug-active';
import { renderTugResults } from './tug-results';
import { renderTugStepCalibration } from './tug-step-calibration';

export const tugModule: AssessmentModule = {
  id: 'tug_v1',
  name: 'Timed Up & Go',
  version: '2.2.0',
  description: 'Measure functional mobility with a timed walk test',

  screens: {
    setup: renderTugSetup,
    instructions: renderTugInstructions,
    practice: renderTugPractice,
    step_calibration: renderTugStepCalibration,
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
      'session_metadata.device_os': 'device_os',
      'session_metadata.app_version': 'app_version',
      // Walk-out gait metrics (3 m segment)
      'computed_metrics.time_to_first_step_ms': 'tug_time_to_first_step',
      'computed_metrics.walk_out_steps': 'tug_walk_out_steps',
      'computed_metrics.walk_out_distance_m': 'tug_walk_out_distance',
      'computed_metrics.walk_out_duration_ms': 'tug_walk_out_duration',
      'computed_metrics.walk_out_avg_stride_length_m': 'tug_walk_out_avg_stride',
      'computed_metrics.walk_out_stride_cv': 'tug_walk_out_stride_cv',
      'computed_metrics.walk_out_cadence_spm': 'tug_walk_out_cadence',
      'computed_metrics.walk_out_avg_step_time_ms': 'tug_walk_out_avg_step_time',
      'computed_metrics.walk_out_step_time_cv': 'tug_walk_out_step_time_cv',
      'computed_metrics.walk_out_gait_speed_mps': 'tug_walk_out_gait_speed',
    },
  },

  metrics: [
    { key: 'tug_time_s', label: 'TUG Time', unit: 's', higherIsBetter: false },
    { key: 'walk_out_gait_speed_mps', label: 'Gait Speed', unit: 'm/s', higherIsBetter: true },
    { key: 'walk_out_cadence_spm', label: 'Cadence', unit: 'spm', higherIsBetter: true },
    { key: 'walk_out_avg_stride_length_m', label: 'Avg Stride', unit: 'm', higherIsBetter: true },
    { key: 'time_to_first_step_ms', label: 'Time to first step', unit: 'ms', higherIsBetter: false },
  ],

  getInstructions(): InstructionConfig {
    return {
      title: 'Timed Up & Go',
      body: 'Hold the phone against your sternum and the app automatically detects each phase of the walk test.',
      importantPoints: [
        'Hold the phone flat against the center of your chest (sternum)',
        'Start seated in a chair with your back against the chair',
        'Sit still — the test starts automatically after 3 seconds',
        'Walk at a comfortable, safe pace',
        'You may use a walking aid if needed',
      ],
      showMeHow: false,
    };
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

    let summary = `${timeS.toFixed(1)}s • ${bandLabel} • ${aid}`;
    if (m.walk_out_cadence_spm) {
      summary += ` • ${Math.round(m.walk_out_cadence_spm)} spm`;
    }
    return summary;
  },

  getSparklineValue(result: AssessmentResult): number {
    return result.computed_metrics.tug_time_s ?? 0;
  },
};
