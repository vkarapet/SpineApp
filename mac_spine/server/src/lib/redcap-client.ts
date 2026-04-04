import { Config } from './config.js';

/**
 * Check if a participant (record_id) exists in REDCap.
 * Uses exportRecords with a filter to check for the record.
 */
export async function verifyParticipant(
  config: Config,
  recordId: string,
): Promise<boolean> {
  const params = new URLSearchParams({
    token: config.redcapApiToken,
    content: 'record',
    format: 'json',
    type: 'flat',
    records: recordId,
    fields: 'record_id',
    returnFormat: 'json',
  });

  const response = await fetch(config.redcapApiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!response.ok) {
    throw new Error(`REDCap exportRecords failed: HTTP ${response.status}`);
  }

  const records = await response.json() as unknown[];
  return records.length > 0;
}

/**
 * Check if a record with the given local_uuid already exists in REDCap.
 * Returns true if a duplicate is found (skip import).
 */
export async function checkDuplicate(
  config: Config,
  recordId: string,
  localUuid: string,
  instrument: string,
): Promise<boolean> {
  const params = new URLSearchParams({
    token: config.redcapApiToken,
    content: 'record',
    format: 'json',
    type: 'flat',
    records: recordId,
    fields: 'record_id,local_uuid',
    forms: instrument,
    returnFormat: 'json',
  });

  const response = await fetch(config.redcapApiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!response.ok) {
    throw new Error(`REDCap dedup check failed: HTTP ${response.status}`);
  }

  const records = await response.json() as Array<Record<string, unknown>>;
  return records.some((r) => r.local_uuid === localUuid);
}

/**
 * Import a single record into REDCap using importRecords.
 * Returns the count of records imported.
 */
export async function importRecord(
  config: Config,
  redcapRecord: Record<string, unknown>,
): Promise<{ count: number }> {
  const params = new URLSearchParams({
    token: config.redcapApiToken,
    content: 'record',
    format: 'json',
    type: 'flat',
    overwriteBehavior: 'normal',
    data: JSON.stringify([redcapRecord]),
    returnFormat: 'json',
  });

  const response = await fetch(config.redcapApiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  const body = await response.json();

  // REDCap can return HTTP 200 with an error object
  if (!response.ok || (body && typeof body === 'object' && 'error' in body)) {
    const errorMsg = (body as Record<string, unknown>)?.error ?? `HTTP ${response.status}`;
    throw new Error(`REDCap importRecords failed: ${errorMsg}`);
  }

  return body as { count: number };
}
