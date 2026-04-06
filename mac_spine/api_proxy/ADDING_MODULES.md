# Adding a New Assessment Module to the API Proxy

When a new assessment module is added to the MAC Spine PWA, the API proxy must be updated to handle its data. This file describes exactly what needs to change.

---

## What needs updating

Only one file: **`src/lib/field-maps.ts`**

---

## Steps

### 1. Define the field map

Add a new `ModuleFieldMap` object that maps local payload keys (sent by the PWA) to REDCap field names (as defined in the REDCap data dictionary).

```typescript
const exampleFieldMap: ModuleFieldMap = {
  instrument: 'example_task',           // REDCap instrument name
  localUuidField: 'example_local_uuid', // REDCap field name for the session UUID
  fields: {
    // 'local_payload_key': 'redcap_field_name'
    'local_uuid': 'example_local_uuid',
    'timestamp_start': 'example_timestamp',
    'computed_metrics.some_metric': 'example_some_metric',
    'session_metadata.device_os': 'example_device_os',
    // ... one entry per field
  },
};
```

### 2. Register it in FIELD_MAPS

Add the new map to the `FIELD_MAPS` lookup, keyed by the module's `task_type` (the same string used in the PWA's module registration):

```typescript
const FIELD_MAPS: Record<string, ModuleFieldMap> = {
  grip_v1: gripFieldMap,
  tug_v1: tugFieldMap,
  example_v1: exampleFieldMap,  // <-- add here
};
```

### 3. Deploy

```bash
cd mac_spine/api_proxy
npx wrangler deploy
```

---

## Field naming conventions

Every REDCap field in the data dictionary is prefixed with the instrument short name. The proxy field map must use these prefixed names exactly. For example, for a module with instrument `grip_task`:

| Local payload key | REDCap field |
|---|---|
| `local_uuid` | `grip_local_uuid` |
| `session_metadata.device_os` | `grip_device_os` |
| `session_metadata.screen_width_px` | `grip_screen_width` |
| `session_metadata.screen_height_px` | `grip_screen_height` |
| `session_metadata.app_version` | `grip_app_version` |

Dot-notation keys (e.g. `computed_metrics.frequency_hz`) are resolved from nested objects in the payload automatically.

---

## How it works

The proxy uses the field map to:

1. **Validate** — reject payloads with an unrecognized `task_type`
2. **Deduplicate** — query REDCap for existing records using `localUuidField`
3. **Transform** — convert the local payload into a REDCap-formatted record
4. **Mark complete** — automatically sets `{instrument}_complete = '2'`

No other proxy files need changes. Routing, HMAC verification, CORS, participant checks, and the import logic are all module-agnostic.

---

## Checklist

- [ ] REDCap data dictionary updated with new instrument and fields
- [ ] Field map added to `src/lib/field-maps.ts`
- [ ] `task_type` key in `FIELD_MAPS` matches the PWA module's `task_type`
- [ ] All REDCap field names match the data dictionary exactly (prefixed)
- [ ] Worker redeployed with `npx wrangler deploy`
