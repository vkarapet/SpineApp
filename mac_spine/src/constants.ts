export const APP_VERSION = '1.0.0';
export const CONSENT_VERSION = '1.0';
export const DB_NAME = 'mac_spine';
export const DB_VERSION = 3;
export const PROXY_URL = 'https://mac-spine-proxy.macspine.workers.dev/proxy';
export const MAX_AUDIT_ENTRIES = 10_000;
export const MAX_LOCAL_SESSIONS = 5_000;
export const SYNC_BACKOFF_BASE_MS = 5_000;
export const SYNC_BACKOFF_MULTIPLIER = 3;
export const SYNC_BACKOFF_CAP_MS = 405_000;
export const SYNC_MAX_ATTEMPTS = 5;
export const BATCH_THRESHOLD = 10;
export const CLOCK_DRIFT_THRESHOLD_MS = 60_000;
export const INSTALL_PROMPT_DELAY_DAYS = 7;
export const IOS_SYNC_WARNING_DAYS = 5;
export const PRACTICE_DURATION_MS = 5_000;
export const INCREMENTAL_SAVE_INTERVAL_MS = 2_000;
export const GRIP_DURATION_MS = 10_000;
export const GRIP_MIN_FINGERS = 3;
export const GRIP_PRACTICE_DURATION_MS = 5_000;
export const INCREMENTAL_SAVE_GRIP_COUNT = 5;
export const TUG_NORMAL_THRESHOLD_S = 10;
export const TUG_HIGH_RISK_THRESHOLD_S = 13.5;
export const TUG_MAX_DURATION_MS = 120_000;

// TUG Sensor — Step detection (defaults for StepDetector; overridden by TUG_CONFIG in tug-types.ts)
export const TUG_STEP_MIN_INTERVAL_MS = 300;
export const TUG_STEP_PEAK_VALLEY_MAX_MS = 500;
export const TUG_STEP_INITIAL_THRESHOLD = 2.0;        // m/s²
export const TUG_STEP_THRESHOLD_ADAPT_RATE = 0.2;
export const TUG_WEINBERG_K = 0.45;
export const TUG_STEP_SMOOTH_WINDOW = 5;

// TUG Sensor — Data management
export const TUG_SENSOR_SAVE_INTERVAL_MS = 3000;
export const TUG_CALIBRATION_SAMPLES = 60;
export const TUG_STILLNESS_ACCEL_TOLERANCE = 0.5;    // m/s² from gravity magnitude
export const TUG_STILLNESS_DURATION_MS = 3000;        // 3 seconds of stillness to auto-start

export const INTENDED_USE_STATEMENT =
  'MAC Spine is a research data collection tool intended for use in IRB-approved studies. ' +
  'It is not intended to diagnose, treat, cure, or prevent any disease. ' +
  'Assessment results are collected for research analysis and are not intended to inform ' +
  'individual clinical decisions without independent clinical evaluation.';
