import { getProfile, getAllResults, getAuditLog } from '../core/db';
import { addAuditEntry } from '../core/db';

export async function exportDataAsJSON(): Promise<void> {
  const profile = await getProfile();
  const results = await getAllResults();
  const auditLog = await getAuditLog();

  const exportData = {
    exported_at: new Date().toISOString(),
    record_id: profile?.subject_hash ?? 'unknown',
    // No email in export — privacy requirement
    sessions: results.map((r) => ({
      local_uuid: r.local_uuid,
      timestamp_start: r.timestamp_start,
      task_type: r.task_type,
      status: r.status,
      session_metadata: r.session_metadata,
      computed_metrics: r.computed_metrics,
      flagged: r.flagged,
      flag_reason: r.flag_reason,
      synced: r.synced,
      checksum: r.checksum,
    })),
    audit_log: auditLog,
  };

  const blob = new Blob([JSON.stringify(exportData, null, 2)], {
    type: 'application/json',
  });
  downloadBlob(blob, `mmat-export-${new Date().toISOString().slice(0, 10)}.json`);

  await addAuditEntry({
    action: 'data_exported',
    entity_id: profile?.subject_hash ?? null,
    details: { format: 'json', sessions: results.length },
  });
}

export async function exportDataAsCSV(): Promise<void> {
  const profile = await getProfile();
  const results = await getAllResults();

  // Collect all unique metric keys across all results
  const metricKeys = new Set<string>();
  for (const r of results) {
    for (const key of Object.keys(r.computed_metrics)) {
      metricKeys.add(key);
    }
  }
  const sortedMetricKeys = Array.from(metricKeys).sort();

  const headers = [
    'date',
    'task_type',
    'hand',
    ...sortedMetricKeys,
    'flagged',
    'flag_reason',
    'synced',
  ];

  const rows = results.map((r) => [
    r.timestamp_start,
    r.task_type,
    r.session_metadata.hand_used,
    ...sortedMetricKeys.map((key) => r.computed_metrics[key] ?? ''),
    r.flagged,
    r.flag_reason ?? '',
    r.synced,
  ]);

  const csv = [
    headers.join(','),
    ...rows.map((row) =>
      row.map((v) => (typeof v === 'string' && v.includes(',') ? `"${v}"` : String(v))).join(','),
    ),
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv' });
  downloadBlob(blob, `mmat-export-${new Date().toISOString().slice(0, 10)}.csv`);

  await addAuditEntry({
    action: 'data_exported',
    entity_id: profile?.subject_hash ?? null,
    details: { format: 'csv', sessions: results.length },
  });
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
