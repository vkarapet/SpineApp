export const APP_VERSION = '1.0.0';
export const STUDY_SALT = 'mmat-study-2026';
export const CONSENT_VERSION = '1.0';
export const DB_NAME = 'mmat';
export const DB_VERSION = 1;
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

export const INTENDED_USE_STATEMENT =
  'MMAT is a research data collection tool intended for use in IRB-approved studies. ' +
  'It is not intended to diagnose, treat, cure, or prevent any disease. ' +
  'Assessment results are collected for research analysis and are not intended to inform ' +
  'individual clinical decisions without independent clinical evaluation.';
