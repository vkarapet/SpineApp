import type { AssessmentModule, RawSessionData, ComputedMetrics, InstructionConfig, PracticeConfig, MetadataField } from '../../types/assessment';
import { computeGripMetrics } from './grip-metrics';
import { GRIP_PRACTICE_DURATION_MS, GRIP_DURATION_MS } from '../../constants';

export const gripModule: AssessmentModule = {
  id: 'grip_v1',
  name: 'Grip & Release Test',
  version: '1.0.0',
  description: 'Measure grip speed, rhythm, and coordination over 10 seconds',

  redcap: {
    instrument: 'grip_task',
    fieldMap: {
      local_uuid: 'local_uuid',
      timestamp_start: 'grip_timestamp',
      'computed_metrics.duration_actual_ms': 'grip_duration',
      'computed_metrics.tap_count': 'grip_count',
      'computed_metrics.frequency_hz': 'grip_freq',
      'computed_metrics.accuracy_mean_dist_px': 'grip_spatial_variance',
      'computed_metrics.accuracy_pct_in_target': 'grip_valid_pct',
      'computed_metrics.rhythm_cv': 'grip_regularity',
      'session_metadata.hand_used': 'grip_hand',
      'session_metadata.fatigue_rating': 'grip_fatigue',
      'session_metadata.medication_taken': 'grip_medication',
      flagged: 'grip_flagged',
      flag_reason: 'grip_flag_reason',
      raw_data: 'grip_raw_json',
      checksum: 'grip_checksum',
      device_id: 'device_id',
      'session_metadata.device_os': 'device_os',
      'session_metadata.screen_width_px': 'screen_width',
      'session_metadata.screen_height_px': 'screen_height',
      'session_metadata.app_version': 'app_version',
    },
  },

  metrics: [
    { key: 'frequency_hz', label: 'Grips per second', unit: 'Hz', higherIsBetter: true },
    { key: 'rhythm_cv', label: 'Consistency score', unit: '%', higherIsBetter: true },
    { key: 'spatial_variance_px', label: 'Spatial consistency', unit: 'px', higherIsBetter: false },
  ],

  getInstructions(): InstructionConfig {
    return {
      title: 'Grip & Release Test',
      body: 'Grip the phone with 4 fingers touching the screen, then release. Repeat as fast as you can.',
      importantPoints: [
        'Place the phone in your palm, screen facing up',
        'Grip the phone with 4 fingers touching the screen, then release all fingers',
        'A grip only counts when 4+ fingers touch at the same time',
        'The test lasts 10 seconds',
      ],
      showMeHow: true,
    };
  },

  getPracticeConfig(): PracticeConfig {
    return {
      durationMs: GRIP_PRACTICE_DURATION_MS,
      showFeedback: true,
      showCounter: true,
    };
  },

  createUI(_container: HTMLElement): void {
    // UI is created by the individual screen components
  },

  start(): void {
    // Started by grip-active.ts
  },

  stop(): RawSessionData {
    return [];
  },

  computeMetrics(rawData: RawSessionData): ComputedMetrics {
    return computeGripMetrics(rawData, GRIP_DURATION_MS);
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
};
