/**
 * REDCap field mappings per assessment module.
 *
 * Each map translates local payload keys to REDCap field names.
 * Dot notation (e.g. "computed_metrics.frequency_hz") indicates nested keys.
 */

export interface ModuleFieldMap {
  instrument: string;
  fields: Record<string, string>;
}

const tappingFieldMap: ModuleFieldMap = {
  instrument: 'tapping_task',
  fields: {
    'local_uuid': 'local_uuid',
    'timestamp_start': 'tap_timestamp',
    'computed_metrics.duration_actual_ms': 'tap_duration',
    'computed_metrics.tap_count': 'tap_count',
    'computed_metrics.frequency_hz': 'tap_freq',
    'computed_metrics.accuracy_mean_dist_px': 'tap_accuracy',
    'computed_metrics.accuracy_pct_in_target': 'tap_accuracy_pct',
    'computed_metrics.rhythm_cv': 'tap_regularity',
    'session_metadata.hand_used': 'tap_hand',
    'session_metadata.fatigue_rating': 'tap_fatigue',
    'session_metadata.medication_taken': 'tap_medication',
    'flagged': 'tap_flagged',
    'flag_reason': 'tap_flag_reason',
    'raw_data': 'tap_raw_json',
    'checksum': 'tap_checksum',
    'session_metadata.device_os': 'device_os',
    'session_metadata.screen_width_px': 'screen_width',
    'session_metadata.screen_height_px': 'screen_height',
    'session_metadata.target_radius_px': 'target_radius',
    'session_metadata.app_version': 'app_version',
  },
};

const gripFieldMap: ModuleFieldMap = {
  instrument: 'grip_task',
  fields: {
    'local_uuid': 'local_uuid',
    'timestamp_start': 'grip_timestamp',
    'computed_metrics.duration_actual_ms': 'grip_duration',
    'computed_metrics.tap_count': 'grip_count',
    'computed_metrics.frequency_hz': 'grip_freq',
    'computed_metrics.rhythm_cv': 'grip_regularity',
    'session_metadata.hand_used': 'grip_hand',
    'session_metadata.fatigue_rating': 'grip_fatigue',
    'session_metadata.medication_taken': 'grip_medication',
    'flagged': 'grip_flagged',
    'flag_reason': 'grip_flag_reason',
    'raw_data': 'grip_raw_json',
    'checksum': 'grip_checksum',
    'session_metadata.device_os': 'device_os',
    'session_metadata.screen_width_px': 'screen_width',
    'session_metadata.screen_height_px': 'screen_height',
    'session_metadata.app_version': 'app_version',
  },
};

const tugFieldMap: ModuleFieldMap = {
  instrument: 'tug_task',
  fields: {
    'local_uuid': 'local_uuid',
    'timestamp_start': 'tug_timestamp',
    'computed_metrics.duration_actual_ms': 'tug_duration',
    'computed_metrics.tug_time_s': 'tug_time',
    'session_metadata.fatigue_rating': 'tug_fatigue',
    'session_metadata.medication_taken': 'tug_medication',
    'session_metadata.walking_aid': 'tug_walking_aid',
    'flagged': 'tug_flagged',
    'flag_reason': 'tug_flag_reason',
    'raw_data': 'tug_raw_json',
    'checksum': 'tug_checksum',
    'session_metadata.device_os': 'device_os',
    'session_metadata.screen_width_px': 'screen_width',
    'session_metadata.screen_height_px': 'screen_height',
    'session_metadata.app_version': 'app_version',
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
};

const FIELD_MAPS: Record<string, ModuleFieldMap> = {
  tapping_v1: tappingFieldMap,
  grip_v1: gripFieldMap,
  tug_v1: tugFieldMap,
};

export function getFieldMap(taskType: string): ModuleFieldMap | undefined {
  return FIELD_MAPS[taskType];
}

/**
 * Resolve a dot-notation key from a nested object.
 * e.g. getNestedValue(obj, "computed_metrics.frequency_hz")
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

/**
 * Transform a local payload record into a REDCap-formatted record
 * using the field map for the given task type.
 */
export function transformRecord(
  recordId: string,
  payload: Record<string, unknown>,
  fieldMap: ModuleFieldMap,
): Record<string, unknown> {
  const redcapRecord: Record<string, unknown> = {
    record_id: recordId,
    redcap_repeat_instrument: fieldMap.instrument,
    redcap_repeat_instance: 'new',
  };

  for (const [localKey, redcapField] of Object.entries(fieldMap.fields)) {
    const value = getNestedValue(payload, localKey);
    if (value !== undefined) {
      redcapRecord[redcapField] = value;
    }
  }

  return redcapRecord;
}
