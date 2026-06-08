/**
 * REDCap field mappings per assessment module.
 *
 * Each map translates local payload keys to REDCap field names.
 * Dot notation (e.g. "computed_metrics.frequency_hz") indicates nested keys.
 */

export interface ModuleFieldMap {
  instrument: string;
  localUuidField: string;
  fields: Record<string, string>;
}

const gripFieldMap: ModuleFieldMap = {
  instrument: 'grip_task',
  localUuidField: 'grip_local_uuid',
  fields: {
    'local_uuid': 'grip_local_uuid',
    'timestamp_start': 'grip_timestamp',
    'computed_metrics.duration_actual_ms': 'grip_duration',
    'computed_metrics.tap_count': 'grip_count',
    'computed_metrics.frequency_hz': 'grip_freq',
    'computed_metrics.rhythm_cv': 'grip_regularity',
    'session_metadata.hand_used': 'grip_hand',
    'session_metadata.hand_weakness': 'grip_hand_weakness',
    'flagged': 'grip_flagged',
    'flag_reason': 'grip_flag_reason',
    'raw_data': 'grip_raw_json',
    'checksum': 'grip_checksum',
    'session_metadata.device_os': 'grip_device_os',
    'session_metadata.screen_width_px': 'grip_screen_width',
    'session_metadata.screen_height_px': 'grip_screen_height',
    'session_metadata.app_version': 'grip_app_version',
  },
};

const tugFieldMap: ModuleFieldMap = {
  instrument: 'tug_task',
  localUuidField: 'tug_local_uuid',
  fields: {
    'local_uuid': 'tug_local_uuid',
    'timestamp_start': 'tug_timestamp',
    'computed_metrics.tug_time_s': 'tug_time',
    'session_metadata.walking_aid': 'tug_walking_aid',
    'session_metadata.cue_distance_m': 'tug_cue_distance_m',
    'session_metadata.end_trigger': 'tug_end_trigger',
    'flagged': 'tug_flagged',
    'flag_reason': 'tug_flag_reason',
    'raw_data': 'tug_raw_json',
    'checksum': 'tug_checksum',
    'session_metadata.app_version': 'tug_app_version',
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
    'session_metadata.calibration_snapshot.calibrated_at': 'tug_cal_calibrated_at',
    'session_metadata.calibration_snapshot.app_version': 'tug_cal_app_version',
    'session_metadata.calibration_snapshot.n_steps_used': 'tug_cal_n_steps_used',
    'session_metadata.calibration_snapshot.correlation_floor': 'tug_cal_correlation_floor',
    'session_metadata.calibration_snapshot.avg_stride_length_m': 'tug_cal_avg_stride_length_m',
    'session_metadata.calibration_snapshot.avg_step_time_ms': 'tug_cal_avg_step_time_ms',
    'session_metadata.calibration_snapshot.template': 'tug_cal_template',
    'session_metadata.calibration_snapshot.template_dt_ms': 'tug_cal_template_dt_ms',
  },
};

const FIELD_MAPS: Record<string, ModuleFieldMap> = {
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

  // Mark instrument as complete — every record reaching the proxy is a
  // finalised session; REDCap will show Incomplete (0) otherwise.
  redcapRecord[`${fieldMap.instrument}_complete`] = '2';

  return redcapRecord;
}
