import { MappingProperty } from '@opensearch-project/opensearch/api/types';
import { z } from 'zod';

/**
 * OpenSearch Index Mapping
 */
export const logMapping = {
  properties: {
    id: { type: 'keyword' },
    timestamp: { type: 'date' },
    severity: { type: 'keyword' },
    source: { type: 'keyword' },
    action: { type: 'keyword' },
    message: { type: 'text' },
    user: { type: 'keyword' },
    service: { type: 'keyword' },
    // Entra / User fields
    category: { type: 'keyword' },
    status: { type: 'keyword' },
    ip_address: { type: 'ip' },
    user_upn: { type: 'keyword' },
    app_name: { type: 'keyword' },
    result_description: { type: 'text' },
    metadata: { type: 'object', enabled: false }, // Store as untyped JSON, disable indexing
  },
};

// Simple IP regex fallback
const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

/**
 * Zod Schema for User Activity Logs (Client-side)
 */
export const userActivityLogSchema = z.object({
  user_upn: z.string().email().optional(),
  action: z.string().min(1),
  resource_id: z.string().optional(),
  ip_address: z.string().optional(),
  user_agent: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional()
});

/**
 * Zod Schema for System Logs
 */
export const systemLogSchema = z.object({
  severity: z.enum(['info', 'warning', 'error', 'success', 'debug']),
  action: z.string().min(1),
  message: z.string().min(1),
  source: z.string().min(1),
  service: z.string().optional(),
  user: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional()
});
