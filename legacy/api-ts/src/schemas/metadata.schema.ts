export const metadataMapping = {
  properties: {
    key: { type: 'keyword' }, // e.g., 'last_sync_status'
    lastRun: { type: 'date' },
    mode: { type: 'keyword' }, // 'initial' | 'incremental'
    status: { type: 'keyword' }, // 'success' | 'failed'
    durationMs: { type: 'long' },
    stats: {
      properties: {
        devices: { type: 'integer' },
        users: { type: 'integer' }
      }
    },
    updatedAt: { type: 'date' }
  }
};
