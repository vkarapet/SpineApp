import express from 'express';

const app = express();
const PORT = 3001;

// In-memory store
const records = new Map<string, unknown[]>();
const registrations = new Map<string, unknown>();

app.use(express.json({ limit: '1mb' }));

// CORS
app.use((_req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.header(
    'Access-Control-Allow-Headers',
    'Content-Type, X-Request-Signature, X-Request-Timestamp',
  );
  next();
});

app.options('*', (_req, res) => res.sendStatus(204));

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    redcap_reachable: true,
    version: '1.0.0-stub',
    timestamp: new Date().toISOString(),
  });
});

// Main proxy endpoint
app.post('/api/proxy', (req, res) => {
  const { action, record_id, payload } = req.body;

  if (!action || !record_id) {
    return res.status(400).json({ error: 'Missing action or record_id' });
  }

  // Log request
  const logEntry = {
    timestamp: new Date().toISOString(),
    action,
    record_id: record_id.substring(0, 8),
    status: 200,
  };

  switch (action) {
    case 'upload_data': {
      if (!records.has(record_id)) {
        records.set(record_id, []);
      }

      const existing = records.get(record_id)!;

      if (payload.records) {
        // Batch upload
        for (const record of payload.records as { local_uuid: string }[]) {
          const duplicate = existing.find(
            (r) => (r as { local_uuid: string }).local_uuid === record.local_uuid,
          );
          if (!duplicate) {
            existing.push(record);
          }
        }
      } else {
        // Single upload — dedup check
        const duplicate = existing.find(
          (r) => (r as { local_uuid: string }).local_uuid === payload.local_uuid,
        );
        if (!duplicate) {
          existing.push(payload);
        }
      }

      console.log(`[${logEntry.timestamp}] ${action} for ${logEntry.record_id}... — ${existing.length} records`);
      return res.json({ success: true, count: existing.length });
    }

    case 'upload_registration': {
      registrations.set(record_id, payload);
      console.log(`[${logEntry.timestamp}] ${action} for ${logEntry.record_id}...`);
      return res.json({ success: true });
    }

    case 'fetch_history': {
      const data = records.get(record_id) ?? [];
      console.log(`[${logEntry.timestamp}] ${action} for ${logEntry.record_id}... — returning ${data.length} records`);
      return res.json({ success: true, records: data });
    }

    case 'delete_data': {
      records.delete(record_id);
      registrations.delete(record_id);
      console.log(`[${logEntry.timestamp}] ${action} for ${logEntry.record_id}... — deleted`);
      return res.json({ success: true });
    }

    default:
      return res.status(400).json({ error: `Unknown action: ${action}` });
  }
});

// Analytics endpoint
app.post('/api/analytics', (req, res) => {
  console.log(`[Analytics] ${JSON.stringify(req.body)}`);
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`MMAT Proxy Stub running on http://localhost:${PORT}`);
  console.log('Endpoints:');
  console.log('  POST /api/proxy    — Main proxy');
  console.log('  GET  /api/health   — Health check');
  console.log('  POST /api/analytics — Analytics');
});
