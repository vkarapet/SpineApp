# Product Requirements Document (PRD)

**Project Name:** Mobile Modular Assessment Tool (MMAT)
**Version:** 3.0
**Platform:** Progressive Web App (PWA) — Android & iOS
**Target Orientation:** Portrait Mode (Locked)
**Backend:** Mock proxy in Service Worker (production server integration planned)
**Date:** February 17, 2026

---

## Changelog

| Version | Date | Summary |
|---------|------|---------|
| 1.2 | 2026-02-16 | Initial PRD |
| 2.0 | 2026-02-16 | Major revision incorporating UX, architecture, and security reviews |
| 3.0 | 2026-02-17 | Updated to reflect current implementation: three assessment modules (tapping, grip, TUG), pre-assigned participant IDs (no PII collection), mock proxy in service worker, simplified settings and help, local-only data deletion |

---

## 1. Executive Summary

MMAT is an offline-capable Progressive Web App designed for longitudinal remote assessment of motor function in a research context. It features a modular architecture supporting three assessment modules: Rapid Tapping Task, Grip & Release Test, and Timed Up & Go. The app handles user identification via pre-assigned participant IDs, local data persistence via IndexedDB, and data synchronization via an API proxy.

**Current state:** The app uses a mock proxy handler in the service worker that validates and accepts sync payloads locally. This enables the full sync workflow (including clock drift detection and retry logic) to function on any hosting environment, including GitHub Pages. Production deployment will replace the mock proxy with a real server-side endpoint connected to a research database (e.g., REDCap).

**Intended Use Statement:** MMAT is a *research data collection tool* intended for use in IRB-approved studies. It is **not** intended to diagnose, treat, cure, or prevent any disease. Assessment results are collected for research analysis and are not intended to inform individual clinical decisions without independent clinical evaluation.

---

## 2. Platform Rationale

### 2.1 Why PWA Over Native

| Factor | PWA Advantage | Trade-off |
|--------|--------------|-----------|
| **Deployment** | Instant access via URL; no App Store review process | No App Store trust signal; manual install on iOS |
| **Cross-platform** | Single codebase for Android + iOS | Subject to browser engine limitations |
| **Updates** | Instant deployment; no user action needed for patches | Service Worker update lifecycle requires careful management |
| **Cost** | No developer account fees; simpler CI/CD | — |
| **Offline** | Service Worker caching + IndexedDB | iOS Safari storage eviction risk (see §2.3) |
| **Clinical timing** | `performance.now()` provides ~1ms precision on iOS, sub-ms on Android | Not deterministic like native timer APIs |

### 2.2 Accepted Limitations & Mitigations

| Limitation | Impact | Mitigation |
|-----------|--------|------------|
| iOS has no automatic install prompt | Lower PWA install rate | In-app guided install instructions (see §3.6) |
| iOS Safari may evict storage after ~7 days of non-use | Risk of unsynced data loss | Persistent storage request, sync-first design |
| `performance.now()` reduced to ~1ms on Safari (Spectre mitigation) | Slight precision reduction for tap intervals | Acceptable for screening; documented as known limitation |
| Vibration API not supported on iOS | No haptic feedback on iOS | Visual-only feedback; haptic toggle hidden on iOS |
| No native push notifications pre-iOS 16.4 | Cannot remind users to open app | In-app "last assessed" prompt |

### 2.3 iOS Storage Eviction Mitigation

Safari may evict PWA data for apps not used within ~7 days. Mitigations:

1. **Request persistent storage** on first launch via `navigator.storage.persist()`.
2. **Sync-first design:** Always attempt sync immediately after each assessment.
3. **Storage monitoring:** Check `navigator.storage.estimate()` on app open. Warn user if >80% quota used.
4. **User education:** Display "Last synced: X days ago" prominently.

---

## 3. User Experience & Onboarding

### 3.1 First-Run Flow

**Flow:** Splash → Consent → Profile Setup → Main Menu

#### 3.1.1 Splash Screen
- App branding and loading state.
- Service Worker registration check. If first visit and offline, show: "This app requires an internet connection for first-time setup."

#### 3.1.2 Consent & Privacy
- **UI:** Full-screen scrollable consent page.
- **Content sections:**
  - Intended Use Statement
  - Purpose — longitudinal motor assessment data collection for research
  - Procedures — three assessment types (tapping, grip & release, timed up & go), each under a minute
  - Data Handling — data identified by pre-assigned participant ID; no PII collected; optional display name stored locally only
  - Risks & Benefits — no physical risks; privacy mitigated by pseudonymous participant IDs
  - Right to Withdraw — "Delete Device Data" in Settings removes all local data; contact research team for server-side deletion
  - Contact — research team contact via Help section
- **Consent versioning:** Store `consent_version` alongside `consent_date`. When terms are updated, existing users are prompted to re-consent.
- **Actions:**
  - "I have read and agree to the terms" checkbox (minimum 44×44px tap target)
  - "Decline" button — shows message: "You cannot use this app without consenting to the terms." with a "Review Terms Again" option

#### 3.1.3 Profile Setup
- **Input fields:**
  - Participant ID (required) — pre-assigned by research team, validated for format
  - Name (optional) — stored locally only, never transmitted
  - Dominant Hand — Left / Right toggle (default: Right)
- **Validation:** Submit button disabled until participant ID passes validation.

### 3.2 Returning User Flow

1. **Check IndexedDB for user profile.** If found, proceed to Main Menu.
2. **If IndexedDB cleared:** Show splash → full onboarding flow (consent → profile setup).
3. **On app open:** Trigger auto-sync for any pending uploads.

### 3.3 Profile Management

- **Profile widget** on Main Menu displays user name. Tap to open Profile screen.
- **Editable fields:** Name, Dominant Hand.
- **Non-editable field:** Participant ID (displayed read-only).

### 3.4 Main Menu

The central dashboard containing:

- **Header:** App logo (top-left), title, Help (?) and Settings (gear) icons.
- **Profile widget:** Displays user name. Tap to view profile.
- **Sync status:** Pending count with "Sync Now" button, last synced timestamp.
- **Last assessed:** "Last assessed: [date]" or "You haven't completed an assessment yet."
- **Module cards:** Card for each registered module showing:
  - Name, description
  - Last completed date
  - Sparkline graph of historical performance
  - Tap to start assessment
- **View History:** Secondary button linking to session history list.
- **Connectivity indicator:** Online/offline status in header.

### 3.5 Settings Screen

- **Haptic feedback:** Toggle on/off (hidden on iOS where Vibration API is unsupported).
- **Dominant hand:** Left / Right selection.
- **Data Management section:**
  - Storage usage display (used / quota / percentage)
  - Export Device Data — JSON export of all local data
  - Delete Device Data — permanently deletes all local data (confirmation required)
  - Sign Out — clears profile; warns if unsynced sessions exist

### 3.6 Help & Support

- **FAQ section** (expandable details):
  - How do I install this app?
  - Why aren't my taps counting?
  - Why aren't my grips counting?
  - The TUG test isn't detecting my movements
  - My data isn't syncing
- **Test Instructions:** Step-by-step for all three modules:
  - Rapid Tapping Task (10 seconds)
  - Grip & Release Test (10 seconds)
  - Timed Up & Go (sensor-based)
- **Report a Problem:** Email link pre-populated with app version, device OS, browser, last sync status.
- **About:** App name, version, intended use statement, research team contact.

### 3.7 PWA Install Guidance

- **Android:** Intercept `beforeinstallprompt` event. Show install banner after first assessment.
- **iOS:** Detect iOS + not standalone mode. Show step-by-step overlay with Share → Add to Home Screen instructions.
- **Dismissal:** If dismissed, don't show again for 7 days.

### 3.8 App Update Flow

1. New SW installs in background.
2. Show non-blocking toast: "A new version is available. Tap to update."
3. **Never auto-activate during an active assessment.**
4. Activate new SW on explicit user action or next cold start.

---

## 4. Assessment Module: Rapid Tapping Task (v1)

### 4.1 Objective

Measure motor speed (tapping frequency), rhythm (regularity of inter-tap intervals), and spatial accuracy over a 10-second interval.

### 4.2 Task Workflow

#### 4.2.1 Pre-Test Setup (Session Metadata)

Before each assessment, collect:

- **Which hand are you using?** [Left] [Right] (pre-selected from dominant hand preference; user can override)
- **Optional context:**
  - "How are you feeling right now?" [1-5 scale: Very Tired → Very Alert]
  - "Have you taken your medication today?" [Yes / No / N/A]

#### 4.2.2 Instruction Screen

> **Rapid Tapping Task**
>
> Tap the circle as fast as you can using one finger.
>
> **Important:**
> - Lift your finger completely between each tap
> - Using two fingers or holding your finger down will not count
> - The test lasts 10 seconds
>
> *Animated demo showing tap-lift-tap pattern displayed inline*
>
> [Practice] [I'm Ready] Cancel

- **Practice button:** Always available. Navigates to a 5-second practice trial.
- **"I'm Ready" button:** Proceeds directly to countdown.

#### 4.2.3 Practice Trial

- 5-second abbreviated trial with real-time feedback:
  - Valid tap: green pulse on target + haptic buzz
  - Invalid tap (multi-touch / no lift-off): red pulse + "Lift your finger first!" text
  - Tap counter visible during practice
- After practice: "You tapped [N] times." with [Practice Again] and [Back to Instructions] buttons.
- Practice data is **not saved** to assessment results.

#### 4.2.4 Countdown Phase

- **Visual:** Large overlay numbers: **3... 2... 1...**
- **Audio** (if enabled): Beep tone for each second.
- **Haptic** (if enabled): Brief vibration pulse on each number.
- **Cancel option:** "× Cancel" button returns to instruction screen.

#### 4.2.5 Active Phase

**Tap Target:**
- Circle, 120–160px diameter, centered horizontally.
- Positioned in lower third of screen (thumb-reachable zone).
- Offset 10% toward dominant hand side.

**Touch Handling:**
- **Lift-off rule:** Only distinct touch-down → touch-up sequences are counted. Multi-touch contacts are rejected for metrics but recorded in raw data with `rejected: true`.
- **Palm rejection:** Touches with contact radius > 30px are rejected.
- Every touch event records: `{ timestamp, x, y, type (start/end/cancel), touch_id, rejected, reject_reason }`.

**Visual feedback:** Brief color pulse on valid tap. Thin progress bar at top of screen.

**Duration:** 10 seconds (ASSESSMENT_DURATION_MS). Timer starts at GO signal regardless of first tap timing.

**Incremental save:** Tap data written to IndexedDB every 2 seconds or every 10 taps (crash protection, saved as `status: "in_progress"`).

#### 4.2.6 End Signal & Results

- At T=0, input disabled. "Time's Up!" displayed. End tone played.
- 500ms pause before results screen.
- **Results screen** shows: tap count, taps per second, rhythm consistency, accuracy.
- **Save/Discard slider:** User explicitly chooses to save or discard.
  - Save → status changes to `'complete'`, sync triggered
  - Discard → result deleted from IndexedDB

### 4.3 Computed Metrics

| Metric | Key | Description |
|--------|-----|-------------|
| Tap Count | `tap_count` | Valid taps only |
| Frequency | `frequency_hz` | Valid taps / duration (Hz) |
| Rhythm CV | `rhythm_cv` | Coefficient of variation of inter-tap intervals |
| Accuracy (mean distance) | `accuracy_mean_dist_px` | Mean distance from target center (px) |
| Accuracy (% in target) | `accuracy_pct_in_target` | Percentage of taps within target radius |

---

## 5. Assessment Module: Grip & Release Test (v1)

### 5.1 Objective

Measure grip-release motor speed and rhythm by counting full grip-release cycles over a 10-second interval.

### 5.2 Task Workflow

#### 5.2.1 Pre-Test Setup

Same as tapping (§4.2.1): hand selection, optional fatigue/medication.

#### 5.2.2 Instruction Screen

> **Grip & Release Test**
>
> Grip the phone with 3+ fingers, release fully, and repeat as fast as you can for 10 seconds.
>
> 1. Rest the phone in your palm, screen up, hand on a flat surface
> 2. Curl your fingers onto the screen to grip
> 3. Open your fingers completely before each new grip
>
> *Animated diagram alternating between open hand and grip images*
>
> [Practice] [I'm Ready] Cancel

#### 5.2.3 Practice Trial

- 5-second practice with visual finger indicators (circles per touch point, red → green when gripping).
- Grip counter visible during practice.
- After practice: [Practice Again] [Back to Instructions].

#### 5.2.4 Active Phase

- **Minimum fingers:** 3 simultaneous touches required to register a grip.
- **Cycle detection:** Grip activates when ≥3 fingers detected. Full release (all fingers lifted) required before next grip counts.
- **Visual:** Per-finger circle indicators on screen. Progress bar.
- **Duration:** 10 seconds (GRIP_DURATION_MS).
- **Gesture prevention:** Pinch-zoom and multi-touch gestures disabled during active phase.
- **Incremental save:** Every 5 grips or every 2 seconds.

#### 5.2.5 End Signal & Results

Same pattern as tapping: Time's Up → results → save/discard slider.

### 5.3 Computed Metrics

| Metric | Key | Description |
|--------|-----|-------------|
| Grip Count | `grip_count` | Full grip-release cycles |
| Frequency | `frequency_hz` | Grips per second |
| Rhythm CV | `rhythm_cv` | Consistency of grip-release intervals |

---

## 6. Assessment Module: Timed Up & Go (v1)

### 6.1 Objective

Measure functional mobility using the phone's accelerometer and gyroscope to automatically detect phases of the TUG test: standing up, walking out (3m), turning, walking back, and sitting down.

### 6.2 Task Workflow

#### 6.2.1 Pre-Test Setup

- **Walking aid:** None / Cane / Walker / Other
- **Optional:** Fatigue rating (1-5), medication taken (Yes / No / N/A)

#### 6.2.2 Instruction Screen

> **Timed Up & Go**
>
> The phone will go in your pocket and automatically detect each phase:
>
> 1. **Do not turn off the screen** — place the phone in your front trouser pocket with the screen on
> 2. Sit in a chair with your back against the chair
> 3. Sit still — the test starts automatically after 3 seconds
> 4. When you hear the start tone, stand up and walk forward
> 5. You will hear a beep at 3 meters — turn around and walk back to the chair
> 6. Sit down and remain still — an end tone will mark the end of the test
>
> **Note:** Make sure the phone is secure in your pocket. An emergency stop button is always available on screen.
>
> [Test Sound] [Sensor Calibration] [I'm Ready] Cancel

- **Test Sound:** Plays a beep to verify volume.
- **Sensor Calibration:** Navigates to sensor check screen. **Auto-navigates on first TUG run** (no prior TUG results).
- **"I'm Ready":** Proceeds to countdown.

#### 6.2.3 Sensor Calibration

- Requests device motion permission (required on iOS).
- Collects calibration samples (60 samples) to establish gravity baseline.
- Displays sensor status: accelerometer (active/unavailable), gyroscope (active/not available), sample rate, gravity magnitude.
- Warns if gyroscope is unavailable (turn detection may be less accurate).
- After calibration: [Back to Instructions] [Re-Calibrate].

#### 6.2.4 Active Phase

**Phase detection (automated via TugSensorEngine):**

| Phase | Detection Method |
|-------|-----------------|
| Standing Up | Acceleration spike >1.5g + tilt change >45° |
| Walking Out | Step detection via acceleration peaks; distance estimated via Weinberg model |
| Turning (out) | Cumulative gyroscope yaw integration exceeds threshold |
| Walking Back | Same step detection as walking out |
| Turning (sit) | Second cumulative yaw threshold |
| Sitting Down | Impact spike + sustained stillness (1.5s within 0.5 m/s² of gravity) |

**Screen Wake Lock:** Acquired during countdown and active phase to prevent screen dimming. The user **must not manually turn off the screen** — sensor events stop when the screen is off.

**Audio cues:** Start tone, beep at 3m distance, end tone on completion.

**Emergency stop:** Large STOP button always visible. Flags result with "Manual stop during sensor test."

**Safety timeout:** 120 seconds maximum duration.

**Incremental save:** Every 3 seconds with partial sensor data.

#### 6.2.5 Results

- Total time (primary metric)
- Clinical banding: Normal (<10s), Moderate Risk (10–13.5s), High Risk (>13.5s)
- Step count, distance, average stride length
- Per-phase breakdown (stand-up time, walk times, turn durations, sit-down time)
- Save/discard slider

### 6.3 Computed Metrics

| Metric | Key | Description |
|--------|-----|-------------|
| TUG Time | `tug_time_s` | Total test duration (seconds) |
| Total Steps | `total_steps` | Step count across all walking phases |
| Total Distance | `total_distance_m` | Estimated walking distance (meters) |
| Avg Stride Length | `avg_stride_length_m` | Mean stride length |
| Stand-up Duration | `standup_duration_s` | Time to stand from seated |
| Sit-down Duration | `sitdown_duration_s` | Time to sit from standing |
| Turn Yaw (out) | `turn1_cumulative_yaw` | Cumulative turn angle, first turn |
| Turn Yaw (back) | `turn2_cumulative_yaw` | Cumulative turn angle, second turn |
| Phases Completed | `phases_completed` | Number of TUG phases successfully detected |

### 6.4 Sensor Constants

| Constant | Value | Purpose |
|----------|-------|---------|
| Walk distance | 3.0 m | Target walking distance |
| Stand-up accel threshold | 14.7 m/s² (1.5g) | Detect standing motion |
| Stand-up tilt threshold | 45° | Confirm upright posture |
| Sit-down spike threshold | 3.0 m/s² | Detect sitting impact |
| Sit-down rest duration | 1500 ms | Sustained stillness to confirm seated |
| Turn min angle | 15° | Minimum cumulative yaw for turn completion |
| Max test duration | 120 s | Safety timeout |
| Calibration samples | 60 | Gravity baseline establishment |
| Stillness auto-start | 3 s | Duration of stillness before test begins |

---

## 7. Data Management

### 7.1 Local Storage Schema (IndexedDB)

**Database name:** `mmat` | **Version:** 3

#### Object Stores

| Store | Key | Purpose |
|-------|-----|---------|
| `user_profile` | `id` (always "current") | Participant ID, name, preferences, device ID |
| `assessment_results` | `local_uuid` (UUID v4) | Assessment data per session |
| `sync_queue` | `id` (auto-increment) | Pending sync operations with retry metadata |
| `audit_log` | `id` (auto-increment) | Local modification trail |

#### `user_profile` Schema

```
{
  id: "current",
  participant_id: string,        // Pre-assigned by research team
  name: string,                  // Optional display name (local only)
  device_id: string,             // UUID v4, generated on first install
  consent_date: string,          // ISO 8601
  consent_version: string,       // e.g., "1.0"
  last_synced_at: string | null, // ISO 8601
  clock_offset: number | null,   // ms offset from server time
  practice_completed: boolean,
  preferences: {
    audio_enabled: boolean,
    haptic_enabled: boolean,
    dominant_hand: "left" | "right",
    reminder_frequency: "daily" | "every_2_days" | "weekly" | "off"
  },
  created_at: string,
  updated_at: string
}
```

#### `assessment_results` Schema

```
{
  local_uuid: string,            // UUID v4 (Primary Key)
  task_type: string,             // "tapping_v1" | "grip_v1" | "tug_v1"
  status: "in_progress" | "complete" | "flagged",
  timestamp_start: string,       // ISO 8601
  session_metadata: {
    hand_used: "left" | "right",
    dominant_hand: "left" | "right",
    fatigue_rating: number | null,
    medication_taken: boolean | null,
    walking_aid: "none" | "cane" | "walker" | "other" | null,
    screen_width_px: number,
    screen_height_px: number,
    target_radius_px: number,
    device_os: string,
    browser: string,
    app_version: string
  },
  raw_data: RawEvent[],          // Touch events, motion events, or timer events
  computed_metrics: {
    tap_count: number,
    frequency_hz: number,
    rhythm_cv: number,
    accuracy_mean_dist_px: number,
    accuracy_pct_in_target: number,
    duration_actual_ms: number,
    grip_count: number,          // Grip module
    tug_time_s: number,          // TUG module
    total_steps: number,
    total_distance_m: number,
    // ... additional per-module metrics
  },
  flagged: boolean,
  flag_reason: string | null,
  synced: boolean,
  sync_attempts: number,
  checksum: string               // SHA-256 of raw_data JSON
}
```

### 7.2 Synchronization

#### Sync Triggers
- After saving an assessment result
- On app open (auto-sync)
- Manual "Sync Now" button on main menu
- On `online` event (connectivity restored)

#### Sync Flow
1. Query for unsynced results (`synced === false && status === 'complete'`)
2. For ≤10 results: upload individually via `apiCall()`
3. For >10 results: batch upload (10 per batch, 1s delay between batches)
4. Process retry queue (failed items with exponential backoff)
5. Clean up completed sync queue items
6. Prune old synced results (keep max 5,000 locally)
7. Update `last_synced_at` timestamp

#### API Client
- **Endpoint:** `POST /api/proxy`
- **Authentication:** HMAC-SHA256 signature of `(action + record_id + timestamp)` sent in `X-Request-Signature` header
- **Actions:** `upload_data`, `upload_registration`, `delete_data`
- **Clock drift detection:** Compares `Date` response header with local time; warns if drift > 60 seconds

#### Retry Logic
- Exponential backoff: 5s → 15s → 45s → 135s → 405s (capped)
- Maximum 5 attempts per item
- Failed items are never silently dropped

#### Mock Proxy (Current Implementation)
The service worker intercepts `POST /api/proxy` requests and validates:
- Required fields: `action`, `record_id`
- Authentication headers: `X-Request-Timestamp`, `X-Request-Signature`
- Per action: `upload_data` validates `local_uuid`, `task_type`, `timestamp_start` on each record (single or batch)
- Returns `200 { success: true }` with `Date` header for clock drift detection

### 7.3 Save/Discard Pattern

- During active assessment, results are saved with `status: 'in_progress'` (crash-safe, won't sync).
- Results screen presents a save/discard slider component.
- **Save:** Updates status to `'complete'` (or `'flagged'`), triggers sync.
- **Discard:** Deletes the result from IndexedDB entirely.

### 7.4 Data Deletion

- **Delete Device Data** (Settings): Logs an audit entry, then calls `clearAllData()` to wipe all IndexedDB stores. Local-only operation.
- **Sign Out:** Clears profile data. Warns if unsynced sessions exist.
- **Server-side deletion:** Users must contact the research team to request deletion of previously synced data.

### 7.5 Data Export

- **Format:** JSON file containing profile info (participant ID, no PII), all assessment results with computed metrics, session metadata, and audit log.
- **Mechanism:** Generated in-browser, triggered as download via `Blob` URL.

### 7.6 Audit Log

```
{
  id: auto-increment,
  timestamp: string,             // ISO 8601
  action: "assessment_started" | "assessment_completed" | "assessment_flagged" |
          "sync_success" | "sync_failed" |
          "profile_created" | "profile_updated" | "consent_given" |
          "data_exported" | "data_deleted" | "account_signed_out",
  entity_id: string | null,
  details: { ... }
}
```

- Max 10,000 entries; oldest pruned when limit reached.
- Included in data export.

---

## 8. Technical Architecture

### 8.1 Technology Stack

| Layer | Technology | Justification |
|-------|-----------|---------------|
| **Language** | TypeScript | Type safety prevents data schema bugs |
| **Build tool** | Vite | Fast HMR, Rollup production builds, native PWA plugin |
| **Service Worker** | Workbox (via vite-plugin-pwa, injectManifest strategy) | Precaching, routing, custom handlers |
| **Chart library** | Chart.js with `chartjs-adapter-date-fns` | Responsive, accessible, good touch support |
| **Testing** | Vitest (unit) | Fast, Vite-native test runner |
| **Framework** | Vanilla TypeScript | Minimal bundle; direct DOM/event control for timing precision |

### 8.2 Service Worker & Caching

| Resource Type | Strategy | Rationale |
|--------------|----------|-----------|
| App Shell (HTML, core JS/CSS) | Precache (Workbox `precacheAndRoute`) | Instant offline load |
| Static assets (icons, fonts, audio, images) | Cache-First | Never change once deployed |
| Module code | Stale-While-Revalidate | Background updates while ensuring availability |
| API calls (`POST /api/proxy`) | Mock proxy handler | Intercepted and handled locally in SW |
| SPA navigation | NavigationRoute → `index.html` | Offline hash-based routing |

**Update lifecycle:**
1. New SW installs in background.
2. On detection, show toast: "A new version is available. Tap to update."
3. User taps → `SKIP_WAITING` message sent to SW → page reloads.
4. **Never auto-skip during active assessment.**

### 8.3 Routing

Hash-based SPA routing (`#/path`):

| Route | Screen |
|-------|--------|
| `#/splash` | Splash / loading |
| `#/consent` | Consent & privacy |
| `#/profile-setup` | Profile creation |
| `#/menu` | Main menu (hub) |
| `#/settings` | Settings |
| `#/help` | Help & support |
| `#/profile` | Profile view |
| `#/history` | Session history |
| `#/assessment/:moduleId/setup` | Pre-test setup |
| `#/assessment/:moduleId/instructions` | Instructions |
| `#/assessment/:moduleId/practice` | Practice trial |
| `#/assessment/:moduleId/countdown` | Countdown |
| `#/assessment/:moduleId/active` | Active assessment |
| `#/assessment/:moduleId/results` | Results & save/discard |

### 8.4 Module Plugin Architecture

Every assessment module implements the `AssessmentModule` interface:

```typescript
interface AssessmentModule {
  id: string;                    // e.g., "tapping_v1"
  name: string;                  // e.g., "Rapid Tapping Task"
  version: string;               // SemVer
  description: string;

  redcap: {
    instrument: string;
    fieldMap: Record<string, string>;
  };

  metrics: MetricConfig[];

  getInstructions(): InstructionConfig;
  getPracticeConfig?(): PracticeConfig;
  createUI(container: HTMLElement): void;
  start(): void;
  stop(): RawSessionData;
  computeMetrics(rawData: RawSessionData): ComputedMetrics;
  getSessionMetadataFields?(): MetadataField[];
  getSparklineValue(result: AssessmentResult): number;
  getResultSummary(result: AssessmentResult): string;
}
```

Modules are registered at app startup via `ModuleRegistry`. The main menu dynamically lists all registered modules. New modules require implementing this interface and registering in `main.ts`.

**Module versioning:** `task_type` includes a version suffix (e.g., `tapping_v1`). If assessment logic changes significantly, create a new version. Previous version data remains intact.

### 8.5 PWA Manifest

```json
{
  "name": "Mobile Modular Assessment Tool",
  "short_name": "MMAT",
  "description": "Longitudinal motor assessment",
  "start_url": "/index.html?source=pwa",
  "display": "standalone",
  "orientation": "portrait",
  "theme_color": "#1A73E8",
  "background_color": "#FFFFFF",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

### 8.6 HTTPS Setup (Local Development)

- HTTPS required for service workers on non-localhost (phones on LAN).
- Uses `mkcert` for locally-trusted certificates stored in `.certs/` (gitignored).
- `scripts/setup-https.sh` regenerates certs when LAN IP changes.
- `vite.config.ts` auto-loads certs; falls back to HTTP if absent.
- CA cert must be installed on phone once (AirDrop rootCA.pem → install profile → enable trust).

### 8.7 Performance Targets

| Metric | Target |
|--------|--------|
| First Contentful Paint | < 1.5s on 3G |
| Tap registration latency | < 16ms (one frame) |
| Timestamp precision | ≤ 1ms (iOS), < 0.1ms (Android) |
| App shell size | < 50KB gzipped |
| Precache total | ~1 MB |

---

## 9. Accessibility

### 9.1 WCAG Compliance Target

**WCAG 2.1 Level AA** for all non-assessment screens. Active assessment phases are motor tasks that are inherently inaccessible to users who cannot interact with a touchscreen — this is handled explicitly (see §9.3).

### 9.2 Requirements

| Requirement | Standard |
|------------|----------|
| Color contrast (text) | 4.5:1 minimum |
| Color contrast (graphical) | 3:1 minimum |
| Touch targets | 44×44px minimum |
| Font sizes | 16px minimum body text |
| Focus indicators | Visible focus ring |
| Semantic HTML | Proper heading hierarchy, landmarks |
| ARIA labels | All interactive elements |
| Reduced motion | Respect `prefers-reduced-motion` |

### 9.3 Assessment Accessibility Statement

When VoiceOver or TalkBack is detected as active, show before the assessment:

> "This assessment requires [tapping the screen with your finger / gripping the phone with multiple fingers] and is not compatible with screen readers. All other parts of the app — including your results, history, and settings — are fully accessible."

### 9.4 Motor Accessibility Considerations

Given the target population may include users with motor impairments:

- Extra-large touch targets throughout
- Generous spacing between interactive elements
- No time-limited interactions outside assessments
- Dominant hand preference adjusts tap target positioning
- Forgiving UI with clear feedback for rejected inputs

---

## 10. Cross-Browser Compatibility

### 10.1 Browser Support

| Browser | Support Level | Notes |
|---------|--------------|-------|
| Chrome (Android) | **Full** | Primary target |
| Safari (iOS) | **Supported with limitations** | No Vibration API, ~1ms timing precision, storage eviction risk |
| Chrome (iOS) | **Via Safari** | Uses WebKit engine |
| Edge (Android) | **Full** | Chromium-based |
| Desktop browsers | **Functional** | Designed for mobile |

### 10.2 iOS Safari Limitations

| Feature | Status | Workaround |
|---------|--------|------------|
| Vibration API | Not supported | Visual-only feedback; haptic toggle hidden |
| Background Sync API | Not supported | Sync on app open |
| IndexedDB eviction | Aggressive | `navigator.storage.persist()` |
| `screen.orientation.lock()` | Not supported | CSS media query overlay |
| Web Audio autoplay | Blocked until user gesture | Create AudioContext on button tap |
| `performance.now()` precision | ~1ms | Documented as known limitation |

---

## 11. Deployment

### 11.1 GitHub Pages

The app is currently deployed to GitHub Pages via a GitHub Actions workflow. The build uses `base: '/SpineApp/'` in Vite config when `GITHUB_ACTIONS` env var is set. All asset paths are base-path-aware.

### 11.2 Build & Verification

```
cd mmat/
npx vite build        # Production build
npx tsc --noEmit      # Type checking
npx vitest run        # Unit tests
```

### 11.3 Local Development

```
cd mmat/
npm run dev           # Vite dev server with HMR
```

API calls are handled by the mock proxy in the service worker — no separate server is needed.

---

## 12. Future Considerations

### 12.1 Production Server Integration

Replace the mock proxy in the service worker with a real API proxy that connects to a research database (e.g., REDCap). The app's sync logic, HMAC authentication, and retry mechanisms are already built to support this — only the SW route handler needs to be changed back to a network call.

### 12.2 Additional Assessment Modules

The module plugin architecture supports adding new modules without disrupting existing data. New modules require:
1. Implementing the `AssessmentModule` interface
2. Registering in `main.ts`
3. Adding corresponding server-side instrument/field definitions

### 12.3 Native Shell

If App Store distribution becomes necessary, the architecture supports wrapping the web app in a native shell (e.g., Capacitor) with minimal code changes.

### 12.4 Multi-Trial Sessions

Current modules run a single trial per session. Future versions could support configurable multi-trial sessions (e.g., 3 trials, reporting mean or best performance).

---

## Appendix A: Glossary

| Term | Definition |
|------|-----------|
| **MMAT** | Mobile Modular Assessment Tool |
| **PWA** | Progressive Web App |
| **Participant ID** | Pre-assigned identifier provided by the research team |
| **Lift-off Rule** | Multi-touch rejection: a new touch is only counted if the previous touch has been released |
| **CV** | Coefficient of Variation (standard deviation / mean) — used for rhythm measurement |
| **TUG** | Timed Up & Go — a clinical test of functional mobility |
| **Weinberg Model** | Step length estimation from accelerometer peak-to-valley amplitude |
| **Mock Proxy** | Service worker handler that validates sync payloads locally without a real server |
