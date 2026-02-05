export const onboardingStatusMapping = {
  properties: {
    key: { type: 'keyword' }, // Should always be 'onboarding_state'
    currentPhase: { type: 'keyword' }, // pending, connecting_graph, fetching_devices, fetching_users, fetching_enrichment, processing_enrichment, completed, failed
    progress: { type: 'integer' },     // 0-100 percentage (approximate)
    steps: {
      properties: {
        connect_graph: { type: 'keyword' }, // pending, in_progress, completed, failed
        fetch_devices: { type: 'keyword' },
        fetch_users: { type: 'keyword' },
        fetch_licenses: { type: 'keyword' }, // Added as a phase
        fetch_configurations: { type: 'keyword' }, // Added as a phase
        fetch_compliance: { type: 'keyword' }, // Added as a phase
        fetch_apps: { type: 'keyword' }, // Added as a phase
        fetch_security: { type: 'keyword' }, // Added as a phase
        fetch_uxa: { type: 'keyword' }, // Added as a phase
        enrichment: { type: 'keyword' }, // General enrichment processing
        save_data: { type: 'keyword' }, // Saving data to disk
        ingest_api: { type: 'keyword' } // Ingesting data via API
      }
    },
    lastUpdated: { type: 'date' },
    error: { type: 'text' }
  }
};
