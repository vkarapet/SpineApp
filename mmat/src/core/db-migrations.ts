type Migration = (db: IDBDatabase, transaction: IDBTransaction) => void;

const migrations: Record<number, Migration> = {
  1: (db) => {
    // user_profile store
    if (!db.objectStoreNames.contains('user_profile')) {
      db.createObjectStore('user_profile', { keyPath: 'id' });
    }

    // assessment_results store
    if (!db.objectStoreNames.contains('assessment_results')) {
      const results = db.createObjectStore('assessment_results', { keyPath: 'local_uuid' });
      results.createIndex('by_date', 'timestamp_start');
      results.createIndex('by_task', 'task_type');
      results.createIndex('by_sync', 'synced');
      results.createIndex('by_task_date', ['task_type', 'timestamp_start']);
      results.createIndex('unsynced_by_task', ['synced', 'task_type']);
    }

    // sync_queue store
    if (!db.objectStoreNames.contains('sync_queue')) {
      const syncQueue = db.createObjectStore('sync_queue', {
        keyPath: 'id',
        autoIncrement: true,
      });
      syncQueue.createIndex('by_status', 'status');
      syncQueue.createIndex('by_created', 'created_at');
    }

    // audit_log store
    if (!db.objectStoreNames.contains('audit_log')) {
      const auditLog = db.createObjectStore('audit_log', {
        keyPath: 'id',
        autoIncrement: true,
      });
      auditLog.createIndex('by_timestamp', 'timestamp');
      auditLog.createIndex('by_action', 'action');
    }
  },

  2: (_db, transaction) => {
    // Add session_group_id index for multi-trial TUG support
    const store = transaction.objectStore('assessment_results');
    if (!store.indexNames.contains('by_group')) {
      store.createIndex('by_group', 'session_group_id');
    }
  },
};

export function runMigrations(
  db: IDBDatabase,
  oldVersion: number,
  newVersion: number,
  transaction: IDBTransaction,
): void {
  for (let v = oldVersion + 1; v <= newVersion; v++) {
    const migration = migrations[v];
    if (migration) {
      migration(db, transaction);
    }
  }
}
