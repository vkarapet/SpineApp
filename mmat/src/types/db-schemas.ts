import type { ComputedMetrics, RawTapEvent } from './assessment';

export interface UserPreferences {
  audio_enabled: boolean;
  haptic_enabled: boolean;
  dominant_hand: 'left' | 'right';
  reminder_frequency: 'daily' | 'every_2_days' | 'weekly' | 'off';
}

export interface UserProfile {
  id: 'current';
  subject_hash: string;
  first_name: string;
  last_name: string;
  email: string;
  dob: string;
  consent_date: string;
  consent_version: string;
  device_id: string;
  preferences: UserPreferences;
  restoration_pending: boolean;
  clock_offset?: number;
  schema_version?: number;
  created_at: string;
  updated_at: string;
  last_synced_at?: string;
  first_assessment_completed?: boolean;
  install_prompt_dismissed_at?: string;
  practice_completed?: boolean;
}

export interface SessionMetadata {
  hand_used: 'left' | 'right';
  fatigue_rating: number | null;
  medication_taken: boolean | null;
  screen_width_px: number;
  screen_height_px: number;
  target_radius_px: number;
  device_os: string;
  browser: string;
  app_version: string;
}

export interface AssessmentResult {
  local_uuid: string;
  subject_hash: string;
  device_id: string;
  timestamp_start: string;
  task_type: string;
  status: 'in_progress' | 'complete' | 'flagged';
  session_metadata: SessionMetadata;
  raw_data: RawTapEvent[];
  computed_metrics: ComputedMetrics;
  flagged: boolean;
  flag_reason: string | null;
  synced: boolean;
  sync_attempts: number;
  checksum: string;
}

export interface SyncQueueEntry {
  id?: number;
  type: 'upload_data' | 'upload_registration' | 'fetch_history' | 'delete_data';
  payload: Record<string, unknown>;
  local_uuid: string | null;
  status: 'pending' | 'in_flight' | 'failed' | 'completed';
  attempts: number;
  max_attempts: number;
  created_at: string;
  last_attempt_at: string | null;
  next_retry_at: string | null;
  error: string | null;
}

export interface AuditLogEntry {
  id?: number;
  timestamp: string;
  action:
    | 'assessment_started'
    | 'assessment_completed'
    | 'assessment_flagged'
    | 'sync_success'
    | 'sync_failed'
    | 'data_restored'
    | 'profile_created'
    | 'profile_updated'
    | 'consent_given'
    | 'data_exported'
    | 'account_signed_out'
    | 'data_deleted';
  entity_id: string | null;
  details: Record<string, unknown>;
}
