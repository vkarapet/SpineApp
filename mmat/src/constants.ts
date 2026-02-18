export const APP_VERSION = '1.0.0';
export const CONSENT_VERSION = '1.0';
export const DB_NAME = 'mmat';
export const DB_VERSION = 3;
export const PROXY_URL = '/api/proxy';
export const HEALTH_URL = '/api/health';
export const ANALYTICS_URL = '/api/analytics';
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
export const STORAGE_WARNING_THRESHOLD = 0.8;
export const ASSESSMENT_DURATION_MS = 15_000;
export const PRACTICE_DURATION_MS = 5_000;
export const INCREMENTAL_SAVE_INTERVAL_MS = 2_000;
export const INCREMENTAL_SAVE_TAP_COUNT = 10;
export const GRIP_DURATION_MS = 10_000;
export const GRIP_MIN_FINGERS = 3;
export const GRIP_PRACTICE_DURATION_MS = 5_000;
export const INCREMENTAL_SAVE_GRIP_COUNT = 5;
export const TUG_NORMAL_THRESHOLD_S = 10;
export const TUG_HIGH_RISK_THRESHOLD_S = 13.5;
export const TUG_MAX_DURATION_MS = 120_000;

// TUG Sensor — Gravity filter
export const TUG_GRAVITY_FILTER_ALPHA = 0.1;

// TUG Sensor — Standing up
export const TUG_STANDUP_ACCEL_THRESHOLD = 14.7;     // m/s² (1.5g)
export const TUG_STANDUP_TILT_THRESHOLD = 45;         // degrees
export const TUG_STANDUP_TILT_HOLD_MS = 200;
export const TUG_STANDUP_MIN_DURATION_MS = 1000;
export const TUG_STANDUP_MAX_DURATION_MS = 4000;

// TUG Sensor — Step detection
export const TUG_WALK_DISTANCE_M = 3.0;
export const TUG_STEP_MIN_INTERVAL_MS = 300;
export const TUG_STEP_PEAK_VALLEY_MAX_MS = 500;
export const TUG_STEP_INITIAL_THRESHOLD = 2.0;        // m/s²
export const TUG_STEP_THRESHOLD_ADAPT_RATE = 0.2;
export const TUG_WEINBERG_K = 0.45;
export const TUG_STEP_SMOOTH_WINDOW = 5;

// TUG Sensor — Turn detection (cumulative heading + adaptive thresholds)
export const TUG_TURN_MIN_ANGLE = 15;                    // degrees — minimum cumulative yaw for turn completion
                                                          // (pocket gyro undercounts ~4-7× vs real rotation)
export const TUG_TURN_NOISE_GATE_FLOOR = 5;              // °/s — minimum noise gate (below this, don't integrate)
export const TUG_TURN_NOISE_GATE_SCALE = 0.5;            // × walkingYawP75 → adaptive noise gate
export const TUG_TURN_EXIT_RMS_FLOOR = 8;                // °/s — minimum exit threshold for yaw RMS
export const TUG_TURN_EXIT_RMS_SCALE = 0.8;              // × walkingYawP75 → adaptive exit threshold
export const TUG_TURN_RMS_WINDOW_SAMPLES = 30;           // 0.5s at 60Hz — sliding window for yaw RMS
export const TUG_TURN_SETTLE_MS = 200;                   // yaw RMS must stay below exit threshold this long
export const TUG_TURN_MAX_DURATION_MS = 8000;            // safety: force transition after 8s
export const TUG_TURN_WALK_YAW_BUFFER_SIZE = 180;        // ~3s at 60Hz — yaw rate samples from walking phase
export const TUG_YAW_RATE_SMOOTH_ALPHA = 0.3;            // EMA for yaw rate (informational)

// TUG Sensor — Sitting down (spike + sustained stillness)
export const TUG_SITDOWN_SPIKE_THRESHOLD = 3.0;        // m/s² deviation from gravity = impact detected
export const TUG_SITDOWN_REST_ACCEL_TOLERANCE = 0.5;   // m/s² from gravity magnitude
export const TUG_SITDOWN_REST_DURATION_MS = 1500;       // sustained stillness after impact (walking never produces 1.5s of stillness)
export const TUG_SITDOWN_MAX_DURATION_MS = 10000;       // 10s safety (allows for distance overshoot + actual sit)

// TUG Sensor — Data management
export const TUG_SENSOR_SAVE_INTERVAL_MS = 3000;
export const TUG_SENSOR_UI_UPDATE_MS = 100;
export const TUG_CALIBRATION_SAMPLES = 60;
export const TUG_STILLNESS_ACCEL_TOLERANCE = 0.5;    // m/s² from gravity magnitude
export const TUG_STILLNESS_DURATION_MS = 3000;        // 3 seconds of stillness to auto-start

export const INTENDED_USE_STATEMENT =
  'MMAT is a research data collection tool intended for use in IRB-approved studies. ' +
  'It is not intended to diagnose, treat, cure, or prevent any disease. ' +
  'Assessment results are collected for research analysis and are not intended to inform ' +
  'individual clinical decisions without independent clinical evaluation.';
