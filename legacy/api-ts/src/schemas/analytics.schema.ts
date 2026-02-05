// OpenSearch Mappings for Experience Analytics

export interface ExperienceMetric {
  id: string;
  deviceId?: string;
  userId?: string;
  timestamp: string;
  metricType: string;
  score?: number;
  details?: Record<string, any>;
  ingestedAt: string;
}

export interface ExperienceEvent {
  id: string;
  deviceId?: string;
  userId?: string;
  timestamp: string;
  eventType: string;
  severity: string;
  title: string;
  description?: string;
  sourceApp?: string;
  ingestedAt: string;
}

export const experienceMetricsMapping = {
  properties: {
    id: { type: 'keyword' },
    deviceId: { type: 'keyword' },
    userId: { type: 'keyword' },
    timestamp: { type: 'date' },
    metricType: { type: 'keyword' }, // 'startup', 'app_reliability', etc.
    score: { type: 'float' },
    details: { type: 'object' }, // Flexible details
    ingestedAt: { type: 'date' }
  }
};

export const experienceEventsMapping = {
  properties: {
    id: { type: 'keyword' },
    deviceId: { type: 'keyword' },
    userId: { type: 'keyword' },
    timestamp: { type: 'date' },
    eventType: { type: 'keyword' }, // 'crash', 'hang', 'slow_boot'
    severity: { type: 'keyword' }, // 'info', 'warning', 'critical'
    title: { type: 'text' },
    description: { type: 'text' },
    sourceApp: { type: 'keyword' },
    ingestedAt: { type: 'date' }
  }
};
