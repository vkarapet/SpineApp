# Product Requirements Document (PRD)

**Project Name:** Mobile Modular Assessment Tool (MMAT)
**Version:** 1.2
**Platform:** Progressive Web App (PWA) – Android & iOS
**Target Orientation:** Portrait Mode (Locked)
**Backend:** REDCap (via PHP Proxy)
**Date:** February 16, 2026

---

## 1. Executive Summary
The MMAT is an offline-first Progressive Web App (PWA) designed for longitudinal remote assessment of cognitive and motor function. It features a modular architecture, allowing new tests to be added without disrupting existing data. The app handles secure user identification, local data persistence, and **two-way synchronization** (uploading new results and restoring historical data) via a secure PHP middleware to a REDCap project.

---

## 2. Technical Architecture

### 2.1 PWA Specifications
* **Manifest:** Configured for `display: standalone` and `orientation: portrait`.
* **Offline First:** Uses Service Workers for asset caching and `IndexedDB` for local data storage.
* **Device Support:** Android (Chrome/Edge) and iOS (Safari/WebClip).
* **Responsiveness:** UI locks to portrait mode; layout adapts to various screen sizes but strictly enforces vertical orientation.

### 2.2 Security & Data Flow (PHP Proxy)
To protect the REDCap API Token and enable secure two-way sync, a "Serverless Proxy" architecture is required. Direct API calls from the client to REDCap are prohibited.

1.  **Client (PWA):** Sends JSON payloads (containing user credentials and task data) to a hosted `proxy.php` endpoint.
2.  **Proxy Layer:**
    * **Authentication:** Verifies the `record_id` matches the hash of the provided credentials (Email + DOB).
    * **Token Injection:** Injects the stored REDCap API Token (server-side).
    * **Routing:** Forwards requests to REDCap API (`importRecords` for sync, `exportRecords` for restoration).
3.  **REDCap:** Stores data in a longitudinal, repeating instrument structure.

---

## 3. User Experience & Onboarding

### 3.1 First-Run Initialization
1.  **Splash Screen:** App branding and loading state.
2.  **Consent & Privacy:**
    * **UI:** Display brief summary of data usage.
    * **Action:** "Read Full Consent" button (opens modal).
    * **Requirement:** "I agree to the terms..." checkbox must be selected to proceed.
3.  **Profile Setup:**
    * **Input Fields:** First Name, Surname, Date of Birth, Email Address.
    * **ID Generation:** Upon save, the app generates a deterministic **Subject Hash** (e.g., `SHA-256` of `email + dob`). This hash serves as the permanent `record_id`.
4.  **Data Restoration (Two-Way Sync):**
    * Immediately after profile creation, the app checks online connectivity.
    * **If Online:** Requests `fetch_history` from the Proxy. Any existing REDCap data for this `record_id` is downloaded to populate the local graph.
    * **If Offline:** Skips restoration and initializes an empty local database.

### 3.2 Main Menu (The Hub)
The central dashboard containing:
* **Profile Widget:** Displays User Name (tap to edit).
* **Module List:** Scrollable list of available tasks.
    * *Initial Module:* "Rapid Tapping Task".
* **Data Visualization:** Graph widget showing historical trends (see Section 5).
* **Sync Status:**
    * **Visual Indicator:** Green Check (Synced) vs. Red Exclamation (Pending Data).
    * **Logic:** Auto-sync attempts occur on app open and task completion.
    * **Action:** Manual "Sync Now" button.

---

## 4. Assessment Module: Rapid Tapping Task (v1)

### 4.1 Objective
Measure motor speed (frequency), rhythm (regularity), and spatial accuracy over a fixed 15-second interval.

### 4.2 Logic & Constraints
* **Multi-Touch Handling (Lift-off Logic):**
    * To prevent "piano-style" drumming cheats, the app must enforce a "Lift-off" rule.
    * **Rule:** If a second touch is detected (`touchstart`) before the previous touch is released (`touchend`), the new touch is ignored.
    * Only distinct *Touch Down* $\rightarrow$ *Touch Up* sequences are registered.
* **Timestamps:** High-precision timestamps (`performance.now()`) are recorded for every valid touch event.

### 4.3 Task Workflow
1.  **Instruction Screen:** Brief text explaining the task. Button: "I'm Ready."
2.  **Countdown Phase:**
    * **Visual:** Large overlay numbers: **3... 2... 1...**
    * **Audio:** Distinct beep for each second.
3.  **Start Signal:**
    * **Visual:** Screen flashes **GREEN**.
    * **Audio:** High-pitch "GO" tone.
    * **Timer:** 15-second countdown begins immediately.
4.  **Active Phase:**
    * User taps the target area.
    * App records: `{$timestamp, x_coord, y_coord}` for every valid tap.
5.  **Completion:**
    * At **T=0**, input is immediately disabled.
    * Data is saved locally to `IndexedDB`.
    * Auto-sync is triggered.

---

## 5. Data Visualization

### 5.1 Context-Aware Graphing
The Main Menu includes a graphing widget to visualize longitudinal progress.

* **Default View:** Line graph of **"Taps Per Second"** (Frequency) on the Y-axis vs. Date on the X-axis.
* **User Controls:** Dropdown menu to switch Y-Axis metric:
    1.  **Speed:** Taps / Second.
    2.  **Rhythm:** Variance in inter-tap intervals (Lower variance = better rhythm).
    3.  **Accuracy:** Average distance from center (pixels).
* **Data Source:** Plots data from both Local Storage (newly collected) and Restored REDCap History (downloaded).

---

## 6. Data Management

### 6.1 Local Storage Schema (IndexedDB)
Table: `assessment_results`
* `local_uuid` (Primary Key)
* `subject_hash` (The derived User ID)
* `timestamp_start` (ISO 8601)
* `task_type` ("tapping_v1")
* `raw_data` (JSON Array of taps)
* `computed_metrics` (JSON: freq, variance, drift)
* `synced` (Boolean)

### 6.2 Synchronization Logic
* **Trigger:** Auto-attempt after task completion OR Manual press of "Sync" button.
* **Payload Structure:**
    * `record_id`: The Subject Hash.
    * `redcap_repeat_instrument`: "tapping_task".
    * `redcap_repeat_instance`: (Handled via "new" logic).
* **Conflict Resolution:** App always *appends* data as a new repeating instance. It never overwrites existing REDCap rows.

---

## Appendix A: REDCap Data Dictionary
*Format:* CSV-ready structure.
*Setup:* Enable **Repeating Instruments** for the `tapping_task` instrument.

| Variable Name | Form Name | Field Type | Field Label | Note |
| :--- | :--- | :--- | :--- | :--- |
| `record_id` | `registration` | text | Record ID (Hash) | SHA-256 Hash |
| `first_name` | `registration` | text | First Name | |
| `last_name` | `registration` | text | Last Name | |
| `dob` | `registration` | text | Date of Birth | YYYY-MM-DD |
| `email` | `registration` | text | Email Address | |
| `consent_date` | `registration` | text | Consent Timestamp | |
| `tap_timestamp` | `tapping_task` | text | Task Date/Time | ISO 8601 |
| `tap_duration` | `tapping_task` | text | Duration | Default "15" |
| `tap_count` | `tapping_task` | text | Total Taps | Raw Count |
| `tap_freq` | `tapping_task` | text | Frequency (Hz) | Calculated |
| `tap_accuracy` | `tapping_task` | text | Spatial Accuracy | Mean Distance |
| `tap_regularity`| `tapping_task` | text | Rhythm Regularity | CV of Intervals |
| `tap_raw_json` | `tapping_task` | notes | Raw JSON Data | Full coordinate blob |
| `device_os` | `tapping_task` | text | Device OS | Android/iOS |

---

## Appendix B: PHP Proxy Script (`proxy.php`)
*Deployment:* Host on a secure web server (Apache/Nginx).

```php
<?php
// proxy.php
header("Access-Control-Allow-Origin: *"); // Lock to App Domain in prod
header("Content-Type: application/json");

// CONFIGURATION
$apiUrl = '[https://redcap.your-institution.org/api/](https://redcap.your-institution.org/api/)'; // Replace with real URL
$apiToken = 'YOUR_SUPER_SECRET_REDCAP_TOKEN'; // Keep safe

// 1. Get Incoming Data
$input = json_decode(file_get_contents('php://input'), true);
$action = $input['action'] ?? '';
$userHash = $input['record_id'] ?? '';

if (!$action || !$userHash) {
    http_response_code(400);
    echo json_encode(["error" => "Missing action or record_id"]);
    exit;
}

// 2. PAYLOAD PREP
$data = [
    'token' => $apiToken,
    'format' => 'json',
    'type' => 'flat',
    'returnFormat' => 'json'
];

// 3. ROUTING LOGIC
if ($action === 'upload_data') {
    // --- UPLOAD ---
    $data['content'] = 'record';
    $data['data'] = json_encode($input['payload']); 
    $data['overwriteBehavior'] = 'normal'; // Append instances

} elseif ($action === 'fetch_history') {
    // --- RESTORE ---
    $data['content'] = 'record';
    $data['records'] = [$userHash]; // Filter: ONLY this user
    $data['fields'] = ['record_id', 'tap_timestamp', 'tap_freq', 'tap_regularity'];
} else {
    echo json_encode(["error" => "Invalid Action"]);
    exit;
}

// 4. SEND TO REDCAP
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $apiUrl);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($data));

$output = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

// 5. RESPONSE
if ($httpCode == 200) {
    echo $output;
} else {
    http_response_code(500);
    echo json_encode(["error" => "REDCap Error", "details" => $output]);
}
?>