# REDCap Data Dictionary — Generation Guide

This guide documents the rules and lessons learned for generating a valid
`redcap_data_dictionary.csv` that REDCap will accept without errors.

---

## File Overview

| File | Purpose |
|---|---|
| `redcap_data_dictionary.csv` | Upload-ready REDCap data dictionary |
| `grip_v1.json` | Source-of-truth field definitions for the Grip & Release instrument |
| `tug_v1.json` | Source-of-truth field definitions for the TUG instrument |
| `REDCapDataDictonaryDemo.csv` | REDCap's official example — use as a format reference |

The JSON files are the authoritative record of what the app collects and why.
The CSV is derived from them for import into REDCap.

---

## Column Layout

The CSV must have exactly **16 columns** in this fixed order:

| # | Column Name | Notes |
|---|---|---|
| A | Variable / Field Name | Lowercase, underscores only, must be unique |
| B | Form Name | Instrument name, no spaces (use underscores) |
| C | Section Header | Optional. Sets a visual section label in REDCap |
| D | Field Type | See valid types below |
| E | Field Label | Human-readable label shown in REDCap |
| F | Choices / Calculations / Slider Labels | Required for radio/dropdown/checkbox/calc fields |
| G | Field Note | Optional helper text shown below the field |
| H | Text Validation Type | Only valid for `text` fields — see validation rules |
| I | Text Validation Min | Only valid for `text` fields with validation |
| J | Text Validation Max | Only valid for `text` fields with validation |
| K | Identifier? | Only valid value: `y` (or blank) |
| L | Branching Logic | Conditional display logic |
| M | Required Field? | Only valid value: `y` (or blank) |
| N | Custom Alignment | Only valid values: `LH`, `LV`, `RH`, `RV` (or blank) |
| O | Question Number | Surveys only, usually blank |
| P | Matrix Group Name | Usually blank |

---

## Critical Rules

### 1. Encode as plain ASCII — no Unicode characters

REDCap CSV imports are read by spreadsheet software that may not handle UTF-8
correctly. Non-ASCII characters produce mojibake (e.g. the em dash `—` becomes
`‚Äî` when read as Mac Roman).

**Always substitute:**

| Character | Unicode | Replace with |
|---|---|---|
| Em dash `—` | U+2014 | `-` or ` - ` |
| En dash `–` | U+2013 | `-` |
| Degree sign `°` | U+00B0 | ` deg` |
| Curly quotes `"` `"` | U+201C/D | `"` (straight) |
| Ellipsis `…` | U+2026 | `...` |

To check for non-ASCII bytes before uploading:

```python
with open('redcap_data_dictionary.csv', 'rb') as f:
    for i, b in enumerate(f.read()):
        if b > 127:
            print(f'Non-ASCII byte 0x{b:02X} at offset {i}')
```

---

### 2. Quote any field that contains a comma

A CSV field that contains a comma **must** be wrapped in double quotes.
Forgetting this is the single most common source of column-shift errors —
the parser treats each comma inside the value as a column separator, silently
pushing every subsequent column one or more positions to the right.

**Affected fields most often:**
- Column F (Choices) — always contains `|`-delimited pairs with commas
- Column G (Field Note) — if the note mentions JSON structure, e.g. `{t, x, y}`
- Column L (Branching Logic) — safe as long as it has no commas, but quote if unsure

**Wrong:**
```
grip_raw_json,...,Array of events: {t, x, y, type},,,,,,,,
```

**Correct:**
```
grip_raw_json,...,"Array of events: {t, x, y, type}",,,,,,,,
```

---

### 3. Count commas carefully — column shift kills silently

REDCap does not report "wrong column" as an error. Instead it reports symptoms:
a `y` showing up in Custom Alignment instead of Required Field, or branching
logic appearing in the Required Field column. These are all caused by being
one comma off.

**How to count:** After placing your last meaningful value, count the empty
columns remaining to the end of the row and add that many trailing commas.

The distance from column G (Field Note) to column M (Required) is **6 commas**:

```
...,field_note,,,,,,y,,,
               GHIJKLM
               123456
```

A field with G=field_note AND validation (H) filled:

```
...,field_note,number,0,300,,,y,,,
               H      I J  KLM
```

After column M, leave three trailing commas for N, O, P (or fewer if trailing
empties — REDCap accepts rows shorter than 16 columns as long as no used
column is missing).

**To validate column alignment programmatically:**

```python
import csv

EXPECTED_COLS = 16
with open('redcap_data_dictionary.csv', newline='') as f:
    for i, row in enumerate(csv.reader(f), 1):
        if i == 1:
            continue  # skip header
        if len(row) != EXPECTED_COLS:
            print(f'Line {i} ({row[0]}): {len(row)} columns')
        # Check K, M, N for illegal values
        if row[10] not in ('', 'y', 'Y'):
            print(f'Line {i}: bad Identifier value {row[10]!r}')
        if row[12] not in ('', 'y', 'Y'):
            print(f'Line {i}: bad Required value {row[12]!r}')
        if row[13] not in ('', 'LH', 'LV', 'RH', 'RV'):
            print(f'Line {i}: bad Alignment value {row[13]!r}')
        if row[3] == 'notes' and row[7]:
            print(f'Line {i}: notes field has validation {row[7]!r}')
```

---

### 4. Field type constraints

| Field Type | Can have Validation (H)? | Needs Choices (F)? |
|---|---|---|
| `text` | Yes | No |
| `notes` | **No** | No |
| `radio` | No | **Yes** |
| `dropdown` | No | **Yes** |
| `checkbox` | No | **Yes** |
| `calc` | No | Yes (formula) |
| `file` | No | No |

**Common mistake:** setting a validation type on a `notes` field. REDCap
rejects this as an error.

---

### 5. Choices format for radio / dropdown / checkbox

```
value1, Label 1 | value2, Label 2 | value3, Label 3
```

- Values and labels are separated by `, ` (comma space)
- Options are separated by ` | ` (space pipe space)
- The entire string must be quoted in the CSV since it contains commas:
  `"1, Yes | 0, No"`
- Values must be consistent with what the app sends (check the instrument's
  `fieldMap` in `src/modules/<module>/index.ts`)

For boolean fields, use `0, No | 1, Yes` (not `false/true`).

---

### 6. Branching logic syntax

- Use double quotes around comparison values: `[field_name] = "1"`
- If writing inside a CSV-quoted cell, double the double quotes:
  `"[field_name] = ""1"""`
- Single quotes (`'1'`) may be accepted by some REDCap versions but can cause
  syntax errors — prefer double quotes
- Logical operators: `and`, `or` (lowercase)
- Example: `"[grip_flagged] = ""1"""`

---

### 7. Identifier column (K)

Only `y` or blank. Never put any other text in this column. If you accidentally
describe an identifier in the Field Note (G), make sure the note text does not
overflow into column K due to unquoted commas.

---

## Workflow: Updating the Dictionary

1. **Edit the JSON source files first** (`grip_v1.json`, `tug_v1.json`).
   These are the ground truth. Each entry maps a `local_key` (app field path)
   to a `redcap_field` name with type, description, and examples.

2. **Reflect changes in the CSV.** Add/remove rows to match. Use the JSON
   `redcap_field` value as the Variable Name (column A) and the instrument
   name as the Form Name (column B).

3. **Run the ASCII check.** Paste field notes and labels from the JSON — they
   may contain Unicode punctuation copied from documentation.

4. **Run the column-count validator** (script above).

5. **Cross-check field names against `index.ts`**. Every key in the module's
   `fieldMap` must have a corresponding row in the CSV with a matching Variable
   Name.

6. **Upload to REDCap** and address any remaining warnings before saving.

---

## Mapping: App Code to REDCap Field Names

The app's `fieldMap` in each module's `index.ts` maps internal data paths to
REDCap variable names. The CSV must contain a row for every target name in
those maps.

**Note:** Shared device fields (`device_os`, `screen_width`, `screen_height`,
`app_version`) are sent with short unqualified names in the current fieldMap
but are stored in REDCap as instrument-prefixed names (`grip_device_os`,
`tug_device_os`, etc.). The fieldMap will need to be updated to use the
prefixed names before connecting to the live REDCap project. See the `note`
field in each JSON file.
