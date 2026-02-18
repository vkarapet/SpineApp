# Product Requirements Document (PRD)

**Project Name:** Mobile Modular Assessment Tool (MMAT)
**Version:** 2.0
**Platform:** Progressive Web App (PWA) – Android & iOS
**Target Orientation:** Portrait Mode (Locked)
**Backend:** REDCap (via Secure API Proxy)
**Date:** February 16, 2026

---

## Changelog

| Version | Date | Summary |
|---------|------|---------|
| 1.2 | 2026-02-16 | Initial PRD |
| 2.0 | 2026-02-16 | Major revision incorporating UX, architecture, and security reviews. Added: platform rationale, authentication hardening, regulatory compliance section, clinical validity requirements, accessibility standards, non-functional requirements, module plugin architecture, operational requirements, and significantly expanded proxy security specification. |

---

## 1. Executive Summary

The MMAT is an offline-capable Progressive Web App designed for longitudinal remote assessment of cognitive and motor function in a research context. It features a modular architecture allowing new assessment modules to be added without disrupting existing data. The app handles secure user identification, local data persistence, and **two-way synchronization** (uploading new results and restoring historical data) via a secure API proxy to a REDCap project.

**Intended Use Statement:** MMAT is a *research data collection tool* intended for use in IRB-approved studies. It is **not** intended to diagnose, treat, cure, or prevent any disease. Assessment results are collected for research analysis and are not intended to inform individual clinical decisions without independent clinical evaluation. This distinction is critical for regulatory classification (see Section 12).

---

## 2. Platform Rationale

### 2.1 Why PWA Over Native

The PWA architecture was chosen for the following reasons:

| Factor | PWA Advantage | Trade-off |
|--------|--------------|-----------|
| **Deployment** | Instant access via URL; no App Store review process | No App Store trust signal; manual install on iOS |
| **Cross-platform** | Single codebase for Android + iOS | Subject to browser engine limitations |
| **Updates** | Instant deployment; no user action needed for patches | Service Worker update lifecycle requires careful management |
| **Cost** | No developer account fees; simpler CI/CD | — |
| **Offline** | Service Worker caching + IndexedDB | iOS Safari storage eviction risk (see §2.4) |
| **Clinical timing** | `performance.now()` provides ~1ms precision on iOS, sub-ms on Android | Not deterministic like native timer APIs |

### 2.2 Accepted Limitations & Mitigations

| Limitation | Impact | Mitigation |
|-----------|--------|------------|
| iOS has no automatic install prompt | Lower PWA install rate | In-app guided install instructions (see §3.7) |
| iOS Safari may evict storage after ~7 days of non-use | Risk of unsynced data loss | Persistent storage request, sync-first design, user reminders (see §2.4) |
| `performance.now()` reduced to ~1ms on Safari (Spectre mitigation) | Slight precision reduction for tap intervals | Acceptable for screening; documented as known limitation; use `performance.now()` for relative intervals only |
| No native push notifications pre-iOS 16.4 | Cannot remind users to open app | In-app "last assessed" prompt; Service Worker push where supported |
| Browser engine updates outside developer control | Potential for breaking changes | E2E test suite run against browser updates; Playwright CI |

### 2.3 Future Consideration: Native Shell

If clinical validation studies require deterministic timing guarantees or App Store distribution becomes necessary, the architecture supports wrapping the web app in a native shell (e.g., Capacitor) with minimal code changes. The module plugin architecture (§10) and IndexedDB abstraction layer are designed to be portable.

### 2.4 iOS Storage Eviction Mitigation

Safari may evict PWA data for apps not used within ~7 days. The following mitigations are **required**:

1. **Request persistent storage** on first launch via `navigator.storage.persist()`. Display a clear prompt explaining why.
2. **Sync-first design:** Always attempt sync immediately after each assessment. Never rely on local storage as the sole copy.
3. **Storage monitoring:** Check `navigator.storage.estimate()` on app open. Warn user if >80% quota used.
4. **User education:** Display "Last synced: X days ago" prominently. If >5 days since last open on iOS, show a reminder prompt.
5. **Graceful degradation:** If IndexedDB is cleared, detect the empty state on launch and trigger `fetch_history` to restore from REDCap. Show: "Your local data was cleared by the browser. Restoring from server..."

---

## 3. User Experience & Onboarding

### 3.1 First-Run Initialization

**Flow:** Splash → Consent → Profile Setup → Confirmation → Data Restoration → Main Menu

#### 3.1.1 Splash Screen
- App branding and loading state.
- Service Worker registration check. If first visit and offline, show: "This app requires an internet connection for first-time setup. Please connect and try again."

#### 3.1.2 Consent & Privacy
- **UI:** Full-screen scrollable consent page (not a modal — modals are poor UX for long legal text on mobile).
- **Content:** IRB-approved consent language covering: purpose, procedures, risks/benefits, data handling, right to withdraw, contact information. Content managed as an external document referenced by version ID.
- **Consent versioning:** Store `consent_version` (e.g., "1.0") alongside `consent_date` in the data dictionary. When consent terms are updated, existing users are prompted to re-consent on next app open before proceeding.
- **Actions:**
  - "I have read and agree to the terms" checkbox (minimum 44×44px tap target).
  - "Decline" button — shows message: "You cannot use this app without consenting to the terms. You may close the app." with a "Review Terms Again" option.
- **Age verification:** DOB must indicate age ≥ 18 (or local minimum). If under age, show: "This app is intended for adults aged 18 and older."

#### 3.1.3 Profile Setup
- **Input Fields:**
  - First Name (required, `inputmode="text"`, autocapitalize)
  - Last Name (required, `inputmode="text"`, autocapitalize)
  - Date of Birth (required, native date picker — no free-text entry; validate: not in future, age ≥ 18, not before 1900)
  - Email Address (required, `inputmode="email"`, validated against standard email regex, trimmed and lowercased before use)
- **Validation:** All fields validated inline with clear error messages. Submit button disabled until all fields pass validation.
- **Keyboard UX:** Inputs use appropriate `inputmode` attributes. Scroll behavior ensures the active field is visible above the soft keyboard.

#### 3.1.4 Confirmation Screen
After profile entry, display a confirmation screen:
> **Please verify your information:**
> - Name: Jane Smith
> - Date of Birth: March 15, 1985
> - Email: jane@example.com
>
> **Important:** Your email and date of birth are used to link your data across devices. Please ensure they are correct — they cannot be changed later.
>
> [Confirm & Continue] [Go Back & Edit]

#### 3.1.5 ID Generation
Upon confirmation, the app generates a deterministic **Subject Hash**:
- **Canonical input format:** `lowercase(trim(email)) + "|" + dob_in_YYYY-MM-DD + "|" + STUDY_SALT`
  - Example: `"jane@example.com|1985-03-15|mmat-study-2026"`
  - `STUDY_SALT` is a constant defined in app configuration (adds entropy, prevents rainbow table attacks)
- **Hash algorithm:** SHA-256, output as 64-character lowercase hex string.
- **Test vectors** (for implementation verification):
  - Input: `"test@example.com|1990-01-01|mmat-study-2026"` → Hash: [compute at build time and document]
- This hash serves as the permanent `record_id`.

#### 3.1.6 Data Restoration (Two-Way Sync)
Immediately after profile confirmation:

- **If Online:** Show a loading screen with spinner: "Checking for existing data..." Requests `fetch_history` from the proxy.
  - **Success with data:** "Welcome back! We found [N] previous sessions." → Populate local database → Proceed to Main Menu.
  - **Success with no data:** "No previous data found. Let's get started!" → Proceed to Main Menu.
  - **Failure:** "We couldn't reach the server. Your historical data will be loaded when you connect." → Proceed to Main Menu. Schedule retry on next connectivity.
- **If Offline:** Show message: "You're offline. Your historical data will be restored when you connect to the internet." → Proceed to Main Menu with empty local database. Set a `restoration_pending` flag.

### 3.2 Returning User Flow

When a returning user opens the app:

1. **Check IndexedDB for user profile.** If found, auto-load profile and proceed to Main Menu.
2. **If IndexedDB cleared** (browser eviction or manual clear):
   - Show splash → "It looks like your local data was cleared. Please re-enter your details to restore your data."
   - Profile Setup flow (same email + DOB) → generates same `record_id` hash → triggers `fetch_history` → restores data.
3. **On app open:** Trigger auto-sync for any pending uploads and check for `restoration_pending` flag.

### 3.3 Profile Management

- **Profile widget** on Main Menu displays user name. Tap to open Profile screen.
- **Editable fields:** First Name, Last Name only.
- **Non-editable fields:** Email and DOB displayed as read-only with explanation: "These fields are used to identify your data and cannot be changed."
- **If a user needs to change email:** Provide guidance text: "If your email address has changed, please contact the research team at [support email] for assistance with account linking."

### 3.4 Session Security

- **No multi-user device sharing by default.** The app stores one profile at a time.
- **Logout:** Settings screen includes "Sign Out" option which clears local profile data (after confirming all data is synced). On next open, the app returns to the first-run flow.
- **Note:** Full session-based re-authentication is not required for v1 given the research use context. If the app is deployed in clinical settings with shared devices, session PIN protection should be added in a future version.

### 3.5 Main Menu (The Hub)

The central dashboard containing:

- **Profile widget:** Displays user name. Tap to open Profile screen.
- **Connectivity indicator:** Subtle icon in header — cloud icon (online) vs. cloud-with-slash (offline).
- **Sync status indicator:** Separate from connectivity — green checkmark with "All synced" vs. orange badge with "[N] sessions pending sync."
- **Last assessed:** "Last assessed: [date]" or "You haven't completed an assessment yet."
- **Module list:** Scrollable list of available assessment modules.
  - *Initial module:* "Rapid Tapping Task"
  - Each module card shows: name, brief description, last completed date.
- **Data Visualization:** Graph widget showing historical trends (see §5).
- **Sync controls:**
  - Auto-sync on app open and after task completion.
  - Manual "Sync Now" button (minimum 44×44px).
  - Sync progress: "Syncing [N] of [M]..." with progress indication.
- **Navigation:** Access to Settings (gear icon) and Help (question mark icon) in the header.

### 3.6 Settings Screen

- **Audio:** Toggle countdown beeps and GO tone on/off (default: on).
- **Haptic feedback:** Toggle vibration feedback on/off (default: on).
- **Dominant hand:** Left / Right selection (affects tap target positioning — see §4.3.4).
- **Assessment reminders:** Toggle reminders on/off; set frequency (daily, every 2 days, weekly).
- **Data management:** View local storage usage; "Export My Data" (JSON/CSV); "Sign Out" (with sync confirmation).
- **About:** App version, build number, study information, support contact email.

### 3.7 PWA Install Guidance

- **Timing:** Show install prompt **after** the user completes their first assessment (not during onboarding).
- **Android (Chrome):** Intercept the `beforeinstallprompt` event. Show a custom banner: "Add MMAT to your home screen for the best experience." with "Install" and "Not Now" buttons.
- **iOS (Safari):** Detect iOS + not standalone mode. Show a step-by-step overlay with annotated instructions:
  1. "Tap the Share button (square with arrow)"
  2. "Scroll down and tap 'Add to Home Screen'"
  3. "Tap 'Add'"
- **Dismissal:** If dismissed, don't show again for 7 days. Persist in a "Install App" option in Settings.

### 3.8 App Update Flow

When a new Service Worker is detected:

1. New SW installs in the background.
2. Show a non-blocking banner at top of Main Menu: "A new version is available. Tap to update."
3. **Never auto-activate during an active assessment.** Queue the update for next cold start or explicit user action.
4. On update: brief "What's new" note if significant changes.
5. If an update requires a database migration, force the update before allowing new assessments.

### 3.9 Help & Support

Accessible from Main Menu header and Settings:

- **FAQ:** Common questions (taps not counting, data not syncing, how to install, how to interpret results).
- **Test instructions:** Accessible review of tapping task instructions and lift-off rule explanation.
- **Contact:** "Report a Problem" button that opens email pre-populated with app version, device info, OS, and last sync status.
- **Version info:** Displayed at bottom of help screen.

---

## 4. Assessment Module: Rapid Tapping Task (v1)

### 4.1 Objective

Measure motor speed (tapping frequency), rhythm (regularity of inter-tap intervals), and spatial accuracy over a fixed interval.

### 4.2 Clinical Validity Notes

- **Task duration:** 15 seconds per trial. While the Halstead-Reitan standard uses 10-second trials, the 15-second duration was chosen to reduce the startup-effect proportion and provide more stable frequency estimates. **Clinical validation studies should compare MMAT results against established 10-second protocols to establish concordance.**
- **Number of trials:** Minimum 1 trial per session. Future versions should support configurable multi-trial sessions (e.g., 3 trials, reporting mean or best).
- **Lift-off rule rationale:** The lift-off constraint (§4.3) ensures consistent biomechanical measurement (discrete tapping vs. held contact). **All touch events (including rejected multi-touch) are recorded in raw data** so the rule can be retrospectively relaxed during analysis if needed.
- **Known limitations to document in any publication using MMAT data:**
  - Timing precision: ~1ms on iOS Safari, sub-ms on Android Chrome.
  - Spatial accuracy metrics must be normalized by screen dimensions and target size.
  - Results are not directly comparable to established paper-based or hardware-based tapping tests without a concordance study.

### 4.3 Task Workflow

#### 4.3.1 Pre-Test Setup (Session Metadata)

Before each assessment, collect:

- **Which hand are you using?** [Left] [Right] (pre-selected from Settings dominant hand preference; user can override per session)
- **Optional quick context** (configurable by study; may be disabled):
  - "How are you feeling right now?" [1-5 scale: Very Tired → Very Alert]
  - "Have you taken your medication today?" [Yes / No / N/A]

This metadata is stored with the session record.

#### 4.3.2 Instruction Screen

Clear, specific instructions displayed before each test:

> **Rapid Tapping Task**
>
> Tap the circle as fast as you can using one finger.
>
> **Important:**
> - Lift your finger completely between each tap
> - Using two fingers or holding your finger down will not count
> - The test lasts 15 seconds
>
> [Show Me How] [I'm Ready]

- **"Show Me How" button:** Plays a short looping animation demonstrating correct single-finger tapping with the lift-off pattern. Accessible from here and from Help screen.
- **"I'm Ready" button:** Full-width, minimum 56px height, high contrast.

#### 4.3.3 Practice Trial (First Time Only)

On the user's **very first session** (no prior assessment data exists locally or from restoration):

1. After "I'm Ready," show: "Let's do a quick 5-second practice first. This won't be saved."
2. Run an abbreviated 5-second trial with real-time feedback:
   - Valid tap: brief green pulse on target + haptic buzz + "✓" indicator.
   - Invalid tap (multi-touch / no lift-off): brief red pulse + "Lift your finger first!" text.
   - Tap counter visible during practice.
3. After practice: "Great! You tapped [N] times. Ready for the real test?"
   - [Practice Again] [Start Real Test]
4. Practice data is **not saved** to assessment results.

#### 4.3.4 Countdown Phase

- **Cancel option:** Small "✕ Cancel" button in top corner during countdown. Tap returns to instruction screen with no data recorded.
- **Visual:** Large overlay numbers centered on screen: **3... 2... 1...**
  - Countdown numbers: minimum 72px font size, high contrast.
- **Audio** (if enabled in settings): Distinct beep tone for each second. Audio played via Web Audio API with `AudioContext` created/resumed on the "I'm Ready" button tap (required for iOS Safari autoplay policy).
- **Haptic** (if enabled): Brief vibration pulse on each countdown number.
- **Audio fallback:** If Vibration API or AudioContext unavailable, visual cues are sufficient standalone. Audio and haptics are enhancements, not requirements.

#### 4.3.5 Start Signal

- **Visual:** Target area background transitions to green with large "GO!" text (minimum 48px bold). This is a **transition, not a flash** — a sustained green state, not a rapid strobe (WCAG 2.3.1 compliance: no more than 3 flashes per second).
- **Audio** (if enabled): Higher-pitch "GO" tone, distinct from countdown beeps.
- **Timer:** 15-second countdown begins at the GO signal, **regardless of when the first tap occurs.** This must be unambiguous in implementation.

#### 4.3.6 Active Phase

**Tap Target Specification:**
- **Shape:** Circle.
- **Size:** 120px diameter minimum; scales up to 160px on larger screens. Centered horizontally.
- **Vertical position:** Lower third of the screen (thumb-reachable zone). If dominant hand is set to Left, offset target slightly left of center; if Right, slightly right. (Offset: 10% of screen width.)
- **Visual design:** High-contrast filled circle with subtle border. Clearly distinguished from background.
- **Visual feedback per tap:**
  - Valid tap: Brief color pulse (darkening/lightening of target, ~100ms) — subtle enough not to distract but confirming registration.
  - No numeric tap counter during the real test (counters change behavior between sessions).
- **Haptic feedback per tap** (if enabled): 10ms vibration via `navigator.vibrate(10)`. Gracefully degrade if API unavailable (iOS Safari).
- **Timer display decision:** Show a thin progress bar at the top of the screen (not a numeric countdown). This provides time awareness without inducing rushing behavior.

**Touch Handling:**
- **Lift-off rule (Multi-Touch Rejection):** If a `touchstart` is detected before the previous `touchend`, the new touch is **ignored for metric calculation** but **still recorded in raw data** with a `rejected: true` flag.
- **Touch event recording:** Every touch event records: `{ timestamp (performance.now()), x_coord, y_coord, type (start/end), touch_id, rejected (boolean) }`.
- **Timestamps:** `performance.now()` for all relative timing. `Date.now()` for the session start timestamp (ISO 8601).
- **Palm rejection:** Ignore touches with a contact radius > 30px (indicates palm, not fingertip). Record but flag as `rejected: true, reason: "palm"`.

**Gesture Conflict Prevention (required during active phase):**
- `touch-action: none` on the tapping area container.
- `user-select: none` and `-webkit-touch-callout: none` to prevent context menus.
- `overscroll-behavior: none` on body to prevent pull-to-refresh.
- `preventDefault()` on `touchmove` events within the tapping area.
- Intercept `beforeunload` event to warn if navigating away.
- Hide all navigation UI (menu, back buttons) during active phase.
- Position tap target with minimum 20px inset from all screen edges to avoid iOS edge gestures.

**Incremental Save:**
- During active assessment, write tap data to IndexedDB **every 2 seconds** (or every 10 taps, whichever comes first) as a partial record marked `status: "in_progress"`.
- This protects against app crash or battery death mid-test.
- On normal completion, the partial record is replaced with the final complete record.

#### 4.3.7 End Signal & Completion

- At **T=0**, input is immediately disabled.
- **End signal:** Visual — target area transitions to a neutral "complete" state with "Time's Up!" text. Audio (if enabled) — distinct end tone. Haptic — longer vibration pulse (50ms).
- **Brief pause** (500ms) before showing results to provide clear cognitive separation.

#### 4.3.8 Results Screen

After each completed assessment, show:

- **"Test Complete!" header.**
- **Key metrics in user-friendly language:**
  - "You tapped **[N] times** — that's **[X] taps per second**"
  - "Rhythm consistency: **[Good/Fair/Variable]**" (mapped from CV of inter-tap intervals)
  - "Accuracy: **[Excellent/Good/Fair]**" (mapped from mean distance as % of target radius)
- **Comparison** (if previous session data exists): "That's [X]% [faster/slower] than last time" or "About the same as last time" (only show comparison after ≥2 sessions).
- **Sync status:** "Results saved. Syncing..." → "Synced!" or "Saved locally. Will sync when online."
- **Buttons:** [Return to Home] [Take Test Again]
- Auto-sync triggered in background.

### 4.4 Logic & Constraints

- **Multi-Touch Handling (Lift-off Logic):** Only distinct Touch Down → Touch Up sequences are counted for metrics. All events are recorded in raw data.
- **Performance:** Touch handlers must not block the main thread. Use `requestAnimationFrame` for UI updates. Pre-allocate tap array (`new Array(200)`) to minimize GC during assessment.
- **Accidental navigation:** Android back button intercepted during active phase. Shows confirmation: "End test early? Data from this session will be discarded." [End Test] [Continue]

---

## 5. Data Visualization

### 5.1 Context-Aware Graphing

The Main Menu includes a graphing widget to visualize longitudinal progress.

- **Default view:** Line graph of **Tapping Speed** (Taps per Second) on the Y-axis vs. Date on the X-axis.
- **Metric selector:** Dropdown (minimum 44px tap target) to switch Y-axis metric:
  1. **Speed:** "Taps per second" (higher is better ↑)
  2. **Rhythm:** "Consistency score" — displayed as an inverted, normalized scale so higher = more consistent (internally: 1 - CV, scaled 0-100). Label: "Higher is more consistent."
  3. **Accuracy:** "Precision score" — displayed as percentage of taps within target radius, so higher = better. Label: "Higher is more precise."
- **Data source:** Both local (new) and restored (historical) data. Restored data points use a different marker style (open circles vs. filled) with a legend entry: "● This device" / "○ Restored from server."

### 5.2 Empty & Sparse States

| Data Points | Display |
|-------------|---------|
| **0 (no data)** | Friendly illustration with text: "Complete your first assessment to see your progress here." No empty axes. |
| **1** | Single labeled data point (large dot) with stat card: "Your first result: [X] taps/sec." No line. |
| **2** | Two connected points. No trend arrow or percentage change. |
| **3+** | Full line chart with optional trend indication. |

### 5.3 Chart Interactions

- **Tap on data point:** Tooltip showing date, value, and hand used. Example: "Feb 10, 2026 — 5.8 taps/sec (right hand)."
- **Horizontal scroll:** When data exceeds viewport width, allow horizontal panning.
- **Pinch-to-zoom:** Allow horizontal zoom for dense data.
- **Accessible alternative:** Below the chart, a "View as Table" link opens a list/table view of all sessions (see §5.6).

### 5.4 Color & Accessibility

- **Sync status icons:** Green checkmark vs. orange exclamation. Always pair color with distinct shape (checkmark vs. exclamation mark distinguishable in grayscale).
- **Chart lines:** Use distinguishable patterns (solid, dashed, dotted) in addition to color for multiple metrics if displayed simultaneously.
- **Minimum contrast:** 4.5:1 for text, 3:1 for graphical elements (WCAG 2.1 AA).
- **Colorblind safe:** Avoid red/green as the only differentiator. Use blue/orange palette as primary.

### 5.5 Axis Labeling

- **Date axis:** Abbreviated labels ("Feb 10" not "February 10, 2026"). Dynamic label density — show every Nth label based on screen width to prevent overlap. Minimum 12px font size.
- **Y-axis:** Label updates with selected metric, including direction indicator ("↑ Higher is better" or similar).

### 5.6 Session History List

In addition to the chart, provide a list view accessible via "View History" or "View as Table":

- Each row: Date, time, key metrics (speed, rhythm score, accuracy score), hand used, sync status icon.
- Tap a row to see session details (all metrics, device info, session metadata).
- Synced vs. pending sessions visually distinguished.
- **Outlier flagging:** Long-press (or tap + menu) on a session to mark as "Not representative" with optional reason ("phone slipped," "was distracted," "interrupted"). Flagged sessions:
  - Appear greyed out on the chart.
  - Excluded from trend calculations.
  - Remain in raw data and REDCap — flagged with metadata, never deleted.

---

## 6. Data Management

### 6.1 Local Storage Schema (IndexedDB)

**Database name:** `mmat`
**Version:** Managed via sequential migration scripts (see §6.3).

#### Object Stores

| Store | Key | Purpose |
|-------|-----|---------|
| `user_profile` | `id` (always "current") | User credentials, consent status, preferences, device_id |
| `assessment_results` | `local_uuid` (UUID v4) | Core assessment data per session |
| `sync_queue` | `id` (auto-increment) | Pending sync operations with retry metadata |
| `audit_log` | `id` (auto-increment) | Local modification trail for data integrity |

#### `user_profile` Schema

```
{
  id: "current",
  subject_hash: string,          // SHA-256 record_id
  first_name: string,
  last_name: string,
  email: string,                 // stored for display only; hash input is canonical
  dob: string,                   // YYYY-MM-DD
  consent_date: string,          // ISO 8601
  consent_version: string,       // e.g., "1.0"
  device_id: string,             // UUID v4, generated on first install
  preferences: {
    audio_enabled: boolean,
    haptic_enabled: boolean,
    dominant_hand: "left" | "right",
    reminder_frequency: "daily" | "every_2_days" | "weekly" | "off"
  },
  restoration_pending: boolean,
  created_at: string,            // ISO 8601
  updated_at: string             // ISO 8601
}
```

#### `assessment_results` Schema

```
{
  local_uuid: string,            // UUID v4 (Primary Key)
  subject_hash: string,          // The derived record_id
  device_id: string,             // From user_profile.device_id
  timestamp_start: string,       // ISO 8601 (Date.now() at session start)
  task_type: string,             // e.g., "tapping_v1"
  status: "in_progress" | "complete" | "flagged",
  session_metadata: {
    hand_used: "left" | "right",
    fatigue_rating: number | null,       // 1-5 or null
    medication_taken: boolean | null,
    screen_width_px: number,
    screen_height_px: number,
    target_radius_px: number,
    device_os: string,                   // "Android" | "iOS"
    browser: string,                     // User agent string (abbreviated)
    app_version: string
  },
  raw_data: [                    // JSON Array of all touch events
    {
      t: number,                 // performance.now() timestamp (ms)
      x: number,                 // x coordinate
      y: number,                 // y coordinate
      type: "start" | "end",
      touch_id: number,
      rejected: boolean,
      reject_reason: string | null   // "multi_touch" | "palm" | null
    }
  ],
  computed_metrics: {
    tap_count: number,           // Valid taps only
    frequency_hz: number,        // Valid taps / duration
    rhythm_cv: number,           // Coefficient of variation of inter-tap intervals
    accuracy_mean_dist_px: number,  // Mean distance from target center (px)
    accuracy_pct_in_target: number, // % of taps within target radius
    duration_actual_ms: number      // Actual task duration in ms
  },
  flagged: boolean,              // User-marked as "not representative"
  flag_reason: string | null,
  synced: boolean,
  sync_attempts: number,
  checksum: string               // SHA-256 of raw_data JSON string
}
```

#### Indexes

```javascript
// assessment_results indexes
results.createIndex('by_date', 'timestamp_start');
results.createIndex('by_task', 'task_type');
results.createIndex('by_sync', 'synced');
results.createIndex('by_task_date', ['task_type', 'timestamp_start']);
results.createIndex('unsynced_by_task', ['synced', 'task_type']);

// sync_queue indexes
syncQueue.createIndex('by_status', 'status');
syncQueue.createIndex('by_created', 'created_at');

// audit_log indexes
auditLog.createIndex('by_timestamp', 'timestamp');
auditLog.createIndex('by_action', 'action');
```

### 6.2 Sync Queue Design

Each sync operation is managed as a queue entry:

```
{
  id: auto-increment,
  type: "upload_data" | "upload_registration" | "fetch_history",
  payload: { ... },              // REDCap-formatted data
  local_uuid: string | null,     // Links to assessment_results for upload_data
  status: "pending" | "in_flight" | "failed" | "completed",
  attempts: 0,
  max_attempts: 5,
  created_at: string,            // ISO 8601
  last_attempt_at: string | null,
  next_retry_at: string | null,
  error: string | null
}
```

**Retry with exponential backoff:**
- Delays: 5s → 15s → 45s → 135s → 405s (capped).
- After `max_attempts`, mark as `failed` and show user message: "Some data could not be synced. Please check your connection and try again."
- **Failed items are never silently dropped.** This is research data.
- Each assessment is its own sync queue item — no batching of multiple assessments into a single API call (ensures partial failure leaves other items retryable).

**Idempotency:** Include `local_uuid` in every uploaded record as a dedicated REDCap field. The proxy checks for existing records with that UUID before importing, preventing duplicate entries from retry scenarios.

### 6.3 Schema Migration Strategy

```javascript
const migrations = {
  1: (db) => { /* initial schema: all 4 stores */ },
  2: (db) => { /* example: add a future assessment module store */ },
  // Migrations run sequentially: v1 → v2 → v3
  // Users who skip versions get all intermediate migrations
};
```

- New modules that only add object stores are safe, additive migrations.
- Changing indexes on existing stores requires re-indexing — warn on large datasets.
- Store the current schema version in `user_profile.schema_version` for diagnostics.

### 6.4 Synchronization Logic

- **Triggers:** Auto-attempt after task completion, on app open, and manual "Sync Now" button.
- **Background Sync:** Register a Background Sync event (`sync` tag: `upload-results`) on task completion for Chromium browsers. **iOS fallback:** Sync on next app open (Background Sync API not supported on Safari).
- **Payload structure:**
  - `record_id`: The Subject Hash.
  - `local_uuid`: For deduplication.
  - `redcap_repeat_instrument`: e.g., "tapping_task".
  - `redcap_repeat_instance`: Assigned by querying current max instance from REDCap, or using "new" with dedup.
- **Conflict resolution:** Append-only for assessment data. Registration updates use `overwriteBehavior: 'normal'` to update mutable fields (name only).
- **Clock drift detection:** On each successful sync, compare local `Date.now()` with server `Date` response header. If drift > 60 seconds, store `clock_offset` and warn user: "Your device clock may be inaccurate. Please check your date and time settings."
- **Batch upload optimization:** For >10 pending items, batch multiple records into a single `importRecords` call (REDCap supports this). Add 1-second delay between batch calls to respect rate limits.

### 6.5 Audit Log

```
{
  id: auto-increment,
  timestamp: string,             // ISO 8601
  action: "assessment_started" | "assessment_completed" | "assessment_flagged" |
          "sync_success" | "sync_failed" | "data_restored" |
          "profile_created" | "profile_updated" | "consent_given" |
          "data_exported" | "account_signed_out",
  entity_id: string | null,      // local_uuid or record_id
  details: { ... }               // Action-specific metadata
}
```

- Retained locally for troubleshooting.
- Included in data export.
- Max 10,000 entries; oldest pruned when limit reached.

### 6.6 Data Export

Users can export their data from the Settings screen:

- **Format:** JSON file containing: profile info (anonymized record_id, no email), all assessment results with computed metrics, session metadata, and audit log.
- **Alternative format:** CSV with one row per session, metrics as columns.
- **Mechanism:** Generate file in-browser, trigger download via `Blob` URL.
- **Purpose:** User backup, data portability (GDPR), and researcher access to raw data.

### 6.7 Data Deletion

- **Sign Out:** Clears all local data (profile, assessments, sync queue, audit log) after confirming all data is synced. Warns if unsynced data exists.
- **Delete My Data (full erasure):** Available in Settings. Sends a deletion request to the proxy, which:
  1. Marks the REDCap record as deleted/withdrawn (per study protocol).
  2. Confirms deletion to the client.
  3. Client clears all local data.
  - If offline, queue the deletion request and warn user that server-side deletion will occur on next sync.

---

## 7. Technical Architecture

### 7.1 PWA Specifications

- **Manifest:** Full specification (see §7.3).
- **Offline capability:** Service Workers for asset caching; IndexedDB for data storage.
- **Device support:** Android (Chrome, Edge) and iOS (Safari, installed PWA).
- **Orientation:** Portrait locked via manifest `orientation: portrait`. CSS fallback for iOS (which doesn't support `screen.orientation.lock()`): detect landscape via media query, show a full-screen overlay: "Please rotate your device to portrait mode."
- **Safe area handling:** All layouts account for iOS notch/Dynamic Island (`env(safe-area-inset-top)`) and bottom home indicator (`env(safe-area-inset-bottom)`).
- **Minimum viewport:** If viewport < 320px width or < 480px height (e.g., split-screen), show: "Please use MMAT in full-screen mode for accurate assessments."

### 7.2 Service Worker & Caching Strategy

**Layered caching:**

| Resource Type | Strategy | Rationale |
|--------------|----------|-----------|
| App Shell (HTML, core JS/CSS) | Cache-First, fallback to network | Instant offline load. Updated via SW lifecycle. |
| Static assets (icons, fonts, audio) | Cache-First (immutable, hash-busted filenames) | Never change once deployed. |
| Assessment module code | Stale-While-Revalidate | Background updates to module code while ensuring availability. |
| API calls (upload, fetch_history) | Network-Only | Data operations must never serve stale cache. |

**App Shell model:**
```
/
├── index.html              (app shell ~5KB - precached)
├── sw.js                   (service worker)
├── manifest.json
├── assets/
│   ├── app.[hash].js       (core runtime - precached)
│   ├── app.[hash].css      (core styles - precached)
│   └── audio/              (beep.mp3, go.mp3 - precached)
├── modules/
│   └── tapping/
│       ├── tapping.[hash].js   (lazy-loaded)
│       └── tapping.[hash].css  (lazy-loaded)
└── lib/
    ├── db.js               (IndexedDB abstraction)
    ├── sync.js             (sync engine)
    └── chart.js            (visualization)
```

**Update lifecycle:**
1. New SW installs in background.
2. On `controllerchange`, show non-intrusive banner: "Update available. Tap to reload."
3. **Do NOT `skipWaiting()` automatically** — could cause inconsistencies mid-assessment.
4. Activate new SW on explicit user action or next cold start.
5. If a breaking schema migration is needed, force update before allowing assessment use.

**Asset verification:** On app launch, verify all precached assets are present. If any are missing (e.g., Safari eviction), re-fetch from network.

### 7.3 Web App Manifest

```json
{
  "name": "Mobile Modular Assessment Tool",
  "short_name": "MMAT",
  "description": "Longitudinal cognitive and motor assessment",
  "start_url": "/index.html?source=pwa",
  "display": "standalone",
  "orientation": "portrait",
  "theme_color": "#1A73E8",
  "background_color": "#FFFFFF",
  "scope": "/",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ],
  "shortcuts": [
    {
      "name": "Start Assessment",
      "url": "/index.html?module=tapping",
      "icons": [{ "src": "/icons/tapping-96.png", "sizes": "96x96" }]
    }
  ]
}
```

### 7.4 Technology Stack

| Layer | Recommendation | Justification |
|-------|---------------|---------------|
| **Framework** | Preact (~3KB) or Vanilla JS | Minimal bundle; assessment module needs direct DOM/event control for timing precision. React's virtual DOM adds unnecessary overhead. |
| **Build tool** | Vite | Fast HMR, Rollup production builds, native PWA plugin (`vite-plugin-pwa` with Workbox). |
| **Chart library** | Chart.js (~60KB gzip) with `chartjs-adapter-date-fns` | Well-documented, responsive, accessible, good touch support. |
| **Service Worker** | Workbox (via vite-plugin-pwa) | Battle-tested caching strategies, precaching, background sync helpers. |
| **Testing** | Vitest (unit) + Playwright (E2E, touch simulation, mobile emulation) + axe-core (accessibility) | Full coverage with mobile-specific testing. |
| **Language** | TypeScript (recommended) or JavaScript with JSDoc types | Type safety prevents data schema bugs; JSDoc is acceptable if team prefers no build-time types. |
| **Linting** | ESLint + Prettier | Consistent code style. |

### 7.5 Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| First Contentful Paint | < 1.5s on 3G | Lighthouse |
| Time to Interactive | < 3s on 3G | Lighthouse |
| Tap registration latency | < 16ms (one frame) | Custom Playwright harness |
| Timestamp precision | ≤ 1ms (iOS), < 0.1ms (Android) | Platform documentation |
| App shell size | < 50KB gzipped | Build output |
| IndexedDB write (single tap batch) | < 5ms | Performance.now() measurement |
| Lighthouse PWA score | ≥ 90 | Lighthouse CI |

---

## 8. Security & Data Flow (API Proxy)

### 8.1 Architecture Overview

```
Client (PWA)  ──HTTPS──>  API Proxy  ──HTTPS──>  REDCap API
                          (secured)
```

Direct API calls from the client to REDCap are **prohibited**. The proxy serves as an authentication, validation, and rate-limiting gateway.

### 8.2 Proxy Requirements

The proxy **must** implement the following. The Appendix B reference script is a starting specification — production implementation should use a lightweight framework (e.g., PHP Slim, Node.js Express, or Python FastAPI) for structured middleware, validation, and error handling.

#### 8.2.1 CORS

```
Access-Control-Allow-Origin: https://mmat.your-institution.org
Access-Control-Allow-Methods: POST, OPTIONS
Access-Control-Allow-Headers: Content-Type, X-Request-Signature, X-Request-Timestamp
```

- **No wildcards.** Only the specific PWA hosting domain.
- Handle `OPTIONS` preflight requests properly.

#### 8.2.2 HTTPS Enforcement

- Reject all non-HTTPS requests at the proxy level.
- Set `Strict-Transport-Security: max-age=31536000; includeSubDomains` header.

#### 8.2.3 Authentication

Every request from the client must include:

- `record_id`: The subject hash.
- `email`: The user's email (trimmed, lowercased).
- `dob`: The user's DOB (YYYY-MM-DD).
- `X-Request-Timestamp`: Current Unix timestamp.
- `X-Request-Signature`: HMAC-SHA256 of `(action + record_id + timestamp)` using a key derived from the user's credentials.

**Proxy verification:**
1. Compute `SHA-256(lowercase(trim(email)) + "|" + dob + "|" + STUDY_SALT)`.
2. Verify it matches the provided `record_id`. Reject with 403 if mismatch.
3. Verify `X-Request-Timestamp` is within ±5 minutes of server time (prevents replay attacks).
4. Verify `X-Request-Signature` using the same derived key.

#### 8.2.4 Rate Limiting

| Scope | Limit | Window |
|-------|-------|--------|
| Per IP | 30 requests | 1 minute |
| Per `record_id` | 60 requests | 1 hour |
| Global | 600 requests | 1 hour |

Implement at the web server level (e.g., Nginx `limit_req_zone`) and/or in the application. Return HTTP 429 with `Retry-After` header when exceeded.

#### 8.2.5 Input Validation

1. **Action whitelist:** Only `upload_data`, `upload_registration`, `fetch_history`, `delete_data` are valid actions.
2. **Payload schema validation:** Validate against expected field whitelist per action. Reject unknown fields.
3. **`record_id` format:** Must be exactly 64 lowercase hex characters.
4. **Maximum payload size:** 1 MB. Reject larger payloads before parsing.
5. **String sanitization:** Strip HTML/script tags from all string values.
6. **Data type validation:** Numeric fields must be numeric; dates must be valid ISO 8601.

#### 8.2.6 API Token Management

- Store REDCap API token in **environment variable** (`REDCAP_API_TOKEN`), never in source code.
- Token rotation: Document the process for rotating the token if compromised.

#### 8.2.7 Logging

Log every request (structured JSON):
```
{
  "timestamp": "ISO 8601",
  "ip": "client IP",
  "action": "upload_data",
  "record_id": "abc123...",       // first 8 chars only
  "status": 200,
  "duration_ms": 145
}
```

- **Do NOT log:** API token, raw clinical data, full email addresses.
- Retain logs for minimum 90 days.
- Monitor for anomalies: unusual request volumes, failed auth attempts, new IPs accessing many different record_ids.

#### 8.2.8 Content Security Policy

The PWA should serve:
```
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://proxy.your-institution.org; img-src 'self' data:; font-src 'self'; media-src 'self'
```

#### 8.2.9 REDCap Response Handling

Parse the REDCap response body for `"error"` keys even on HTTP 200:
```
if (response contains "error" key) {
  return HTTP 422 with { "error": "REDCap rejected data", "details": error_message }
}
```

#### 8.2.10 Deduplication

For `upload_data` action: before importing, optionally query REDCap for existing records with the same `local_uuid`. If found, skip import and return success (idempotent). This prevents duplicate records from retry scenarios.

### 8.3 Multi-Device Scenario

When the same user accesses MMAT from multiple devices (same email + DOB = same `record_id`):

- Both devices upload independently, creating interleaved repeating instances. This is **correct** for append-only assessment data.
- `fetch_history` returns data from all devices.
- Each record includes `device_id` (UUID per install). The UI can optionally filter by device: "Show: All Devices / This Device Only."
- Users are informed on restoration: "Data from [N] device(s) has been restored."

---

## 9. Accessibility

### 9.1 WCAG Compliance Target

**WCAG 2.1 Level AA** for all non-assessment screens (onboarding, menu, settings, results, history, help).

The active tapping assessment phase is a motor task that is inherently inaccessible to users who cannot interact with a touchscreen. This is acknowledged and handled explicitly (see §9.4).

### 9.2 Requirements

| Requirement | Standard | Details |
|------------|----------|---------|
| Color contrast (text) | 4.5:1 minimum | All body text, labels, buttons |
| Color contrast (graphical) | 3:1 minimum | Chart lines, icons, borders |
| Touch targets | 44×44px minimum | All interactive elements; 48×48px preferred |
| Font sizes | 16px minimum body text | Prevents iOS auto-zoom on input focus |
| Dynamic type | Respect OS font scaling | `rem` units; test at 200% scale |
| Focus indicators | Visible focus ring | For keyboard/switch access navigation |
| Semantic HTML | Proper heading hierarchy, landmarks | `<main>`, `<nav>`, `<header>`, `<section>` |
| ARIA labels | All interactive elements | Buttons, inputs, chart, sync status |
| Reduced motion | Respect `prefers-reduced-motion` | Disable animations, color pulses |

### 9.3 Screen Reader Support

- **All non-assessment screens:** Fully accessible with VoiceOver (iOS) and TalkBack (Android). Proper heading hierarchy, ARIA labels, and focus management.
- **Chart accessibility:** `aria-label` on chart with text summary (e.g., "Line chart showing tapping speed over 12 sessions, trending upward"). Data table alternative available via "View as Table."
- **Sync status:** Announced via `aria-live="polite"` region.

### 9.4 Assessment Accessibility Statement

When VoiceOver or TalkBack is detected as active, show a respectful message before the assessment:

> "This assessment requires tapping the screen with your finger and is not compatible with screen readers. All other parts of the app — including your results, history, and settings — are fully accessible."

### 9.5 Motor Accessibility Considerations

Given the target population may include users with motor impairments:

- **Extra-large touch targets** throughout (not just minimum sizes).
- **Generous spacing** between interactive elements (minimum 8px between adjacent targets).
- **No time-limited interactions** outside the assessment itself. Notifications, banners, and messages persist until dismissed.
- **Dominant hand preference** adjusts tap target positioning.
- **Forgiving UI:** When a tap doesn't register during the test (lift-off rule), the subtle visual feedback indicates why without punishment or frustration.

### 9.6 Typography

| Element | Size | Weight |
|---------|------|--------|
| Body text | 16px minimum | Regular |
| Button labels | 16px minimum | Semi-bold |
| Countdown numbers | 72px+ | Bold |
| "GO!" signal | 48px+ | Bold |
| Chart axis labels | 12px minimum | Regular |
| Section headers | 20px+ | Bold |

---

## 10. Module Plugin Architecture

### 10.1 Module Interface

Every assessment module must implement the following contract:

```typescript
interface AssessmentModule {
  // Identity
  id: string;                    // e.g., "tapping_v1"
  name: string;                  // e.g., "Rapid Tapping Task"
  version: string;               // SemVer, e.g., "1.0.0"
  description: string;

  // REDCap mapping
  redcap: {
    instrument: string;          // REDCap instrument name
    fieldMap: Record<string, string>;  // local key → REDCap field name
  };

  // Visualization
  metrics: Array<{
    key: string;
    label: string;               // User-friendly label
    unit: string;
    higherIsBetter: boolean;
  }>;

  // Schema
  dbSchema?: (db: IDBDatabase) => void;  // Optional module-specific stores

  // Lifecycle
  getInstructions(): InstructionConfig;
  getPracticeConfig?(): PracticeConfig;
  createUI(container: HTMLElement): void;
  start(): void;
  stop(): RawSessionData;
  computeMetrics(rawData: RawSessionData): ComputedMetrics;
  getSessionMetadataFields?(): MetadataField[];
}
```

### 10.2 Module Registry

```typescript
class ModuleRegistry {
  private modules = new Map<string, AssessmentModule>();

  register(module: AssessmentModule): void;
  getModule(id: string): AssessmentModule | undefined;
  getAllModules(): AssessmentModule[];
  getMetrics(id: string): MetricConfig[];
}
```

- Modules are registered at app startup.
- The Main Menu dynamically lists all registered modules.
- The graph widget queries the active module's `metrics` array for Y-axis options.
- New modules require: (1) a module JS file, (2) a REDCap instrument addition, (3) proxy validation rules for the new instrument.

### 10.3 Module Versioning

- `task_type` includes a version suffix (e.g., `tapping_v1`).
- If assessment logic changes significantly (e.g., duration changes), create a new version (`tapping_v2`).
- Previous version data remains intact and queryable.
- Graph can display both versions with a visual separator or version annotation.

---

## 11. Cross-Browser Compatibility

### 11.1 Browser Support Matrix

| Browser | Version | Support Level | Notes |
|---------|---------|--------------|-------|
| Chrome (Android) | 90+ | **Full** | Primary target. All APIs supported. |
| Edge (Android) | 90+ | **Full** | Chromium-based, equivalent to Chrome. |
| Safari (iOS) | 15.4+ | **Supported with known limitations** | See §11.2 |
| Chrome (iOS) | Any | **Via Safari** | iOS Chrome uses WebKit, same as Safari |
| Samsung Internet | 15+ | **Supported** | Chromium-based |
| Firefox (Android) | Not supported | **Not supported** | Limited PWA support |
| Desktop browsers | Any | **Not targeted** | App functions but is designed for mobile |

### 11.2 iOS Safari Limitations & Workarounds

| Feature | iOS Safari Status | Workaround |
|---------|------------------|------------|
| Push Notifications | Supported iOS 16.4+ | In-app reminders as fallback |
| Background Sync API | **Not supported** | Sync on app open; surface pending count |
| IndexedDB eviction | Aggressive under storage pressure | `navigator.storage.persist()`; sync-first design |
| `screen.orientation.lock()` | **Not supported** | CSS media query + UI overlay warning in landscape |
| Web Audio autoplay | Blocked until user gesture | Create `AudioContext` on "I'm Ready" button tap |
| Vibration API | **Not supported** | Visual-only feedback on iOS; haptic toggle hidden |
| `performance.now()` precision | ~1ms (Spectre mitigation) | Acceptable; documented as known limitation |
| Service Worker lifetime | Killed after ~30s inactivity | Design for re-registration on each open |
| Add to Home Screen | No automatic prompt | Custom install guidance overlay (§3.7) |

### 11.3 Touch Event Handling

- **Prefer Pointer Events API** as a unified abstraction where possible, with Touch Events fallback for specific multi-touch detection.
- **Safari `touchcancel`:** Handle as equivalent to `touchend` in lift-off logic to prevent stuck state (Safari fires `touchcancel` on notification banners, control center swipe).
- **Coordinate normalization:** Always compute tap position relative to the target element via `getBoundingClientRect()`, not raw viewport coordinates.

### 11.4 IndexedDB Cross-Browser Notes

- **Safari transaction auto-commit:** Avoid spreading a single transaction across multiple async operations.
- **Error handling:** Wrap all IndexedDB operations in try/catch — Safari throws more `DOMException` variants than Chrome.
- **Storage limits:** ~1GB for installed PWAs on Safari; much less for non-installed web pages.

### 11.5 Audio Cross-Browser

- `AudioContext` must be created/resumed within the same user gesture call stack (all browsers, but especially enforced on iOS Safari).
- Pre-decode all audio buffers before starting the countdown sequence.
- Use `window.AudioContext || window.webkitAudioContext` for Safari compatibility.

---

## 12. Regulatory Compliance

### 12.1 Intended Use & Regulatory Classification

**Intended use:** Research data collection tool for IRB-approved longitudinal assessment studies. Not intended for individual clinical diagnosis or treatment decisions.

**FDA SaMD assessment:** Based on the intended use as a research tool (not clinical decision support), MMAT is anticipated to fall **outside** FDA SaMD jurisdiction. However:

- **Requirement:** Before deployment, a formal regulatory pre-assessment must be conducted with a regulatory consultant to confirm classification.
- **If any study protocol uses MMAT results to inform individual clinical decisions,** the classification changes and FDA clearance may be required.
- **The intended use statement (§1) must be prominently displayed** in all study materials, app documentation, and consent forms.

### 12.2 HIPAA Compliance

If used in a US healthcare/research context:

| Requirement | Implementation |
|------------|----------------|
| BAA coverage | Obtain Business Associate Agreements with hosting provider and REDCap institution |
| Encryption in transit | HTTPS enforced for all proxy communications (TLS 1.2+) |
| Encryption at rest | Proxy server disk encryption; REDCap institutional encryption |
| Access controls | Proxy authentication (§8.2.3); REDCap user roles |
| Audit logging | Proxy request logs (§8.2.7); local audit log (§6.5) |
| Minimum necessary | `fetch_history` returns only fields needed for the requesting module |
| Breach notification | Documented in operational runbook (§14.3) |

### 12.3 GDPR Compliance

If EU participants are enrolled:

| Right | Implementation |
|-------|----------------|
| Right to access | Data export feature (§6.6) |
| Right to erasure | Delete My Data feature (§6.7) |
| Right to portability | JSON/CSV export (§6.6) |
| Informed consent | Full eConsent flow with IRB-approved language (§3.1.2) |
| Data minimization | Collect only fields required for the study |
| Legal basis | Explicit consent for research purposes |

### 12.4 Consent Requirements

The electronic consent (eConsent) flow must include:

1. IRB-approved consent language (provided by study team, not app developer).
2. Clear explanation of: purpose, procedures, risks, benefits, data handling, data sharing, right to withdraw.
3. Contact information for the research team and IRB.
4. Consent version tracking — when consent language is updated, existing users must re-consent.
5. Consent withdrawal mechanism — user can withdraw consent via the app, which triggers data handling per study protocol.
6. Stored in REDCap: `consent_date`, `consent_version`, `consent_method` ("electronic_app").

### 12.5 Data Retention

- Data retention period defined per study protocol (not by the app).
- App stores data locally until synced + confirmed, then local data can be pruned after [configurable] days.
- REDCap data retention per institutional policy.
- End-of-study procedures: documented in operational runbook.

---

## 13. Non-Functional Requirements

### 13.1 Performance

See §7.5 for detailed performance targets.

### 13.2 Reliability

| Requirement | Target |
|------------|--------|
| Assessment data loss | Zero tolerance — incremental save + sync-first design |
| Sync eventual consistency | All data synced within 24 hours of connectivity |
| Proxy uptime | 99.5% (allows ~3.6 hours downtime/month; offline design absorbs outages) |
| Graceful degradation | All offline features work without any server connectivity |

### 13.3 Storage

| Metric | Estimate |
|--------|----------|
| Per session (tapping) | ~2-4 KB (raw data + metadata) |
| 1 year daily use | ~1-1.5 MB |
| Storage warning threshold | 80% of quota |
| Maximum local retention | 5,000 sessions (prunable after sync) |

### 13.4 Security

See §8 for complete security specification. Summary:

- HTTPS only (TLS 1.2+)
- HMAC-authenticated API requests
- Rate-limited proxy
- Input-validated payloads
- CSP headers
- Salted identity hash
- Environment-variable token storage
- Structured access logging

### 13.5 Scalability

The system is designed for research-scale usage:

| Metric | Design Target |
|--------|--------------|
| Concurrent users | 500 |
| Total enrolled participants | 10,000 |
| REDCap records | 1,000,000 repeating instances |
| Proxy throughput | 10 requests/second sustained |

If usage exceeds these targets, the proxy should be horizontally scalable (stateless design, external rate-limit store).

---

## 14. Operational Requirements

### 14.1 Monitoring & Alerting

| Component | Health Check | Alert Condition |
|-----------|-------------|-----------------|
| Proxy server | `/health` endpoint (verifies REDCap connectivity) | Downtime > 5 minutes |
| REDCap API | Checked via proxy `/health` | REDCap returns non-200 |
| Sync failure rate | Aggregated from proxy logs | > 10% failure rate over 1 hour |
| Error rate | Proxy 5xx response count | > 5 errors in 5 minutes |

- Monitor with uptime service (e.g., UptimeRobot, institutional monitoring).
- Alert via email to study operations team.

### 14.2 Backup & Recovery

| Component | Backup Strategy |
|-----------|----------------|
| REDCap data | Institutional REDCap backups (confirm schedule with IT) |
| Proxy configuration | Version-controlled (Git), excluding secrets |
| API token | Stored in secrets manager; documented rotation procedure |
| PWA source code | Git repository with tagged releases |

### 14.3 Incident Response

Document in an operational runbook:

1. **Proxy compromise:** Rotate API token → audit REDCap access logs → notify affected participants → investigate scope → report per IRB requirements.
2. **Data integrity issue:** Compare local audit logs with REDCap records → identify discrepancies → notify study team.
3. **Browser breaking change:** Roll back PWA to last known-good version → test against new browser version → deploy fix.
4. **REDCap URL change:** Update proxy configuration → deploy → trigger re-sync on all clients (via app update).

### 14.4 Deployment & CI/CD

```
CI Pipeline:
├── Lint (ESLint + Prettier)
├── Type check (TypeScript, if used)
├── Unit tests (Vitest)
├── Build (Vite production)
├── Lighthouse audit (PWA score, performance, accessibility)
├── E2E tests (Playwright, including mobile emulation + touch simulation)
├── Accessibility audit (axe-core via Playwright)
├── Deploy to staging (automatic)
└── Deploy to production (manual approval)
```

### 14.5 Analytics (Privacy-Preserving)

Track aggregate, anonymized usage metrics:

- Daily/weekly active users (count only, no identifiers).
- Assessment completion count.
- Sync success/failure rates.
- Average sessions per user per week.
- App version distribution.

Implement via simple server-side counters on the proxy, or a privacy-friendly analytics service. **No third-party tracking scripts in the PWA.**

---

## Appendix A: REDCap Data Dictionary

**Setup:** Enable **Repeating Instruments** for assessment instruments.

### Registration Instrument

| Variable Name | Form Name | Field Type | Field Label | Validation | Note |
|:---|:---|:---|:---|:---|:---|
| `record_id` | `registration` | text | Record ID | 64-char hex | SHA-256 Hash (salted) |
| `first_name` | `registration` | text | First Name | | |
| `last_name` | `registration` | text | Last Name | | |
| `dob` | `registration` | text | Date of Birth | date_ymd | YYYY-MM-DD |
| `email` | `registration` | text | Email Address | email | Canonical (lowercased, trimmed) |
| `consent_date` | `registration` | text | Consent Timestamp | datetime_seconds_ymd | ISO 8601 |
| `consent_version` | `registration` | text | Consent Version | | e.g., "1.0" |
| `device_id` | `registration` | text | Device ID | | UUID per install |
| `app_version` | `registration` | text | App Version | | e.g., "2.0.0" |

### Tapping Task Instrument (Repeating)

| Variable Name | Form Name | Field Type | Field Label | Validation | Note |
|:---|:---|:---|:---|:---|:---|
| `local_uuid` | `tapping_task` | text | Local UUID | | For deduplication |
| `tap_timestamp` | `tapping_task` | text | Task Date/Time | datetime_seconds_ymd | ISO 8601 |
| `tap_duration` | `tapping_task` | text | Duration (ms) | integer | Actual duration |
| `tap_count` | `tapping_task` | text | Total Valid Taps | integer | |
| `tap_freq` | `tapping_task` | text | Frequency (Hz) | number_2dp | Taps/second |
| `tap_accuracy` | `tapping_task` | text | Spatial Accuracy | number_2dp | Mean distance (px) |
| `tap_accuracy_pct` | `tapping_task` | text | Accuracy (% in target) | number_2dp | % taps within target |
| `tap_regularity` | `tapping_task` | text | Rhythm (CV) | number_4dp | CV of inter-tap intervals |
| `tap_hand` | `tapping_task` | radio | Hand Used | | 1=Left, 2=Right |
| `tap_fatigue` | `tapping_task` | radio | Fatigue Rating | | 1-5 scale or blank |
| `tap_medication` | `tapping_task` | radio | Medication Taken | | 1=Yes, 2=No, 3=N/A |
| `tap_flagged` | `tapping_task` | yesno | Flagged as Outlier | | |
| `tap_flag_reason` | `tapping_task` | text | Flag Reason | | |
| `tap_raw_json` | `tapping_task` | notes | Raw JSON Data | | Full event data |
| `tap_checksum` | `tapping_task` | text | Data Checksum | | SHA-256 of raw JSON |
| `device_id` | `tapping_task` | text | Device ID | | For multi-device tracking |
| `device_os` | `tapping_task` | text | Device OS | | Android/iOS |
| `screen_width` | `tapping_task` | text | Screen Width (px) | integer | |
| `screen_height` | `tapping_task` | text | Screen Height (px) | integer | |
| `target_radius` | `tapping_task` | text | Target Radius (px) | integer | For accuracy normalization |
| `app_version` | `tapping_task` | text | App Version | | e.g., "2.0.0" |

---

## Appendix B: API Proxy Specification

The following is a **functional specification** for the API proxy. The production implementation should use a framework (PHP Slim, Express, FastAPI, etc.) rather than raw PHP. This pseudocode describes the required behavior.

### Endpoint: `POST /api/proxy`

#### Request Format

```json
{
  "action": "upload_data | upload_registration | fetch_history | delete_data",
  "record_id": "64-char hex string",
  "email": "user@example.com",
  "dob": "1985-03-15",
  "payload": { }
}
```

**Headers required:**
- `Content-Type: application/json`
- `X-Request-Timestamp: <unix timestamp>`
- `X-Request-Signature: <HMAC-SHA256 signature>`

#### Processing Pipeline

```
1. HTTPS check → reject if not HTTPS (403)
2. CORS origin check → reject if not allowed origin (403)
3. Rate limit check → reject if exceeded (429)
4. Parse JSON body → reject if invalid or > 1MB (400)
5. Validate required fields (action, record_id, email, dob) → reject if missing (400)
6. Validate record_id format (64-char hex) → reject if invalid (400)
7. Verify identity: SHA-256(canonical(email) + "|" + dob + "|" + STUDY_SALT) == record_id → reject if mismatch (403)
8. Verify timestamp within ±5 minutes → reject if stale (403)
9. Verify HMAC signature → reject if invalid (403)
10. Validate action is in whitelist → reject if unknown (400)
11. Validate payload schema per action → reject if invalid (422)
12. Route to REDCap API:
    - upload_data: importRecords (with dedup check on local_uuid)
    - upload_registration: importRecords (overwriteBehavior: normal)
    - fetch_history: exportRecords (filtered by record_id)
    - delete_data: per study protocol
13. Parse REDCap response (check for errors even on HTTP 200)
14. Log request (timestamp, IP, action, record_id prefix, status, duration)
15. Return response to client
```

#### Error Responses

| HTTP Status | Meaning |
|------------|---------|
| 200 | Success |
| 400 | Bad request (missing/invalid fields) |
| 403 | Authentication failure |
| 422 | Validation error (REDCap rejected data) |
| 429 | Rate limit exceeded |
| 500 | Server error (REDCap unreachable) |

All error responses include a JSON body: `{ "error": "description" }`

#### Health Check Endpoint

`GET /api/health`

Returns:
```json
{
  "status": "ok",
  "redcap_reachable": true,
  "version": "2.0.0",
  "timestamp": "2026-02-16T12:00:00Z"
}
```

---

## Appendix C: Glossary

| Term | Definition |
|------|-----------|
| **MMAT** | Mobile Modular Assessment Tool |
| **PWA** | Progressive Web App |
| **Subject Hash** | SHA-256 hash of canonical user credentials + study salt; serves as `record_id` |
| **Lift-off Rule** | Multi-touch rejection: a new touch is only counted if the previous touch has been released |
| **CV** | Coefficient of Variation (standard deviation / mean) — used for rhythm measurement |
| **SaMD** | Software as a Medical Device (FDA classification) |
| **BAA** | Business Associate Agreement (HIPAA requirement) |
| **eConsent** | Electronic informed consent |
| **App Shell** | Minimal HTML/CSS/JS cached for instant offline loading |

---

## Appendix D: Open Questions for Study Team

The following decisions require input from the study team / clinical investigators before finalizing:

1. **Task duration and trials:** Is a single 15-second trial acceptable, or should the protocol include multiple trials (e.g., 3 × 10 seconds)? Clinical validation study design needed.
2. **Contextual metadata fields:** Which pre-session questions should be enabled? Medication timing may be study-specific.
3. **Assessment frequency:** Should the app enforce a minimum interval between assessments (e.g., 1 per day) or allow unlimited sessions?
4. **Normative data:** Are age-adjusted reference ranges available for display on the chart?
5. **Multi-trial design:** If multiple trials per session, should the app report mean, median, or best performance?
6. **Consent language:** IRB-approved consent document must be provided for integration.
7. **Data retention policy:** Define retention period and end-of-study data handling procedures.
8. **Support contact:** Provide support email/phone for in-app help section.
9. **Native shell consideration:** Does the study require App Store distribution (e.g., for participant recruitment or institutional requirements)?
10. **Clinician dashboard:** Is a read-only web portal for clinicians to view participant data required for this study?
