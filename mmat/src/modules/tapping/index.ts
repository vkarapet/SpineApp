import type { AssessmentModule, RawSessionData, ComputedMetrics, InstructionConfig, PracticeConfig, MetadataField } from '../../types/assessment';
import type { AssessmentResult } from '../../types/db-schemas';
import { computeTappingMetrics } from './tapping-metrics';
import { PRACTICE_DURATION_MS, ASSESSMENT_DURATION_MS } from '../../constants';

export const tappingModule: AssessmentModule = {
  id: 'tapping_v1',
  name: 'Rapid Tapping Task',
  version: '1.0.0',
  description: 'Measure motor speed, rhythm, and spatial accuracy over 10 seconds',

  redcap: {
    instrument: 'tapping_task',
    fieldMap: {
      local_uuid: 'local_uuid',
      timestamp_start: 'tap_timestamp',
      'computed_metrics.duration_actual_ms': 'tap_duration',
      'computed_metrics.tap_count': 'tap_count',
      'computed_metrics.frequency_hz': 'tap_freq',
      'computed_metrics.accuracy_mean_dist_px': 'tap_accuracy',
      'computed_metrics.accuracy_pct_in_target': 'tap_accuracy_pct',
      'computed_metrics.rhythm_cv': 'tap_regularity',
      'session_metadata.hand_used': 'tap_hand',
      'session_metadata.fatigue_rating': 'tap_fatigue',
      'session_metadata.medication_taken': 'tap_medication',
      flagged: 'tap_flagged',
      flag_reason: 'tap_flag_reason',
      raw_data: 'tap_raw_json',
      checksum: 'tap_checksum',
      device_id: 'device_id',
      'session_metadata.device_os': 'device_os',
      'session_metadata.screen_width_px': 'screen_width',
      'session_metadata.screen_height_px': 'screen_height',
      'session_metadata.target_radius_px': 'target_radius',
      'session_metadata.app_version': 'app_version',
    },
  },

  metrics: [
    { key: 'frequency_hz', label: 'Taps per second', unit: 'Hz', higherIsBetter: true },
    { key: 'rhythm_cv', label: 'Consistency score', unit: '%', higherIsBetter: true },
    { key: 'accuracy_pct_in_target', label: 'Precision score', unit: '%', higherIsBetter: true },
  ],

  getInstructions(): InstructionConfig {
    return {
      title: 'Rapid Tapping Task',
      body: 'Tap the circle as fast as you can using one finger.',
      importantPoints: [
        'Lift your finger completely between each tap',
        'Using two fingers or holding your finger down will not count',
        'The test lasts 10 seconds',
      ],
      showMeHow: true,
    };
  },

  getPracticeConfig(): PracticeConfig {
    return {
      durationMs: PRACTICE_DURATION_MS,
      showFeedback: true,
      showCounter: true,
    };
  },

  createUI(_container: HTMLElement): void {
    // UI is created by the individual screen components
  },

  start(): void {
    // Started by tapping-active.ts
  },

  stop(): RawSessionData {
    return [];
  },

  computeMetrics(rawData: RawSessionData): ComputedMetrics {
    return computeTappingMetrics(rawData, 0, 0, 70, ASSESSMENT_DURATION_MS);
  },

  getSessionMetadataFields(): MetadataField[] {
    return [
      {
        key: 'hand_used',
        label: 'Which hand are you using?',
        type: 'radio',
        options: [
          { value: 'left', label: 'Left' },
          { value: 'right', label: 'Right' },
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
    return { key: 'frequency_hz', label: 'Taps per second', unit: 'Hz', higherIsBetter: true };
  },

  getHistorySummary(result: AssessmentResult): string {
    const m = result.computed_metrics;
    return `${m.tap_count ?? 0} taps \u2022 ${(m.frequency_hz ?? 0).toFixed(1)} Hz \u2022 ${result.session_metadata.hand_used}`;
  },

  getSparklineValue(result: AssessmentResult): number {
    return result.computed_metrics.frequency_hz ?? 0;
  },
};
