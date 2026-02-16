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

  const headers = [
    'date',
    'task_type',
    'hand',
    'tap_count',
    'frequency_hz',
    'rhythm_cv',
    'accuracy_mean_dist_px',
    'accuracy_pct_in_target',
    'duration_ms',
    'flagged',
    'flag_reason',
    'synced',
  ];

  const rows = results.map((r) => [
    r.timestamp_start,
    r.task_type,
    r.session_metadata.hand_used,
    r.computed_metrics.tap_count,
    r.computed_metrics.frequency_hz,
    r.computed_metrics.rhythm_cv,
    r.computed_metrics.accuracy_mean_dist_px,
    r.computed_metrics.accuracy_pct_in_target,
    r.computed_metrics.duration_actual_ms,
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
