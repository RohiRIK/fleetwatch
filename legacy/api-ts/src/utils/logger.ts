import winston from 'winston';
import Transport from 'winston-transport';
import { Client } from '@opensearch-project/opensearch';
// Use the clientOptions from opensearch config for consistency
import { createOpenSearchClient, OpenSearchConfig, INDICES } from '../config/opensearch';

interface LogEntryMetadata {
  method?: string;
  url?: string;
  status?: number;
  duration?: string;
  user?: string;
  error?: string | object;
  [key: string]: any; // Allow arbitrary metadata
}

interface CustomLogEntry {
  id?: string; // OpenSearch generates if not provided
  timestamp: string;
  severity: 'info' | 'warning' | 'error' | 'success' | 'debug';
  source: string;
  action: string;
  message: string;
  service?: string;
  metadata?: LogEntryMetadata;
}

// Custom transport for OpenSearch
class OpenSearchTransport extends Transport {
  private client: Client;

  constructor(opts: { client: Client; level?: string }) {
    super(opts);
    this.client = opts.client;
  }

  log(info: any, callback: () => void) {
    // Ensure we don't log directly from Bun to avoid process exiting
    setImmediate(async () => {
      try {
        const logEntry: CustomLogEntry = info as CustomLogEntry;
        // Ensure timestamp is always present and in ISO format
        const timestamp = logEntry.timestamp || new Date().toISOString();
        logEntry.timestamp = timestamp;
        
        // Dynamic daily index for system logs
        const date = timestamp.split('T')[0];
        const index = `logs-system-${date}`;

        if (!logEntry.id) {
          logEntry.id = `${timestamp}-${Math.random().toString(36).substring(2, 15)}`;
        }

        await this.client.index({
          index,
          id: logEntry.id, // Use our ID for potentially easier lookup
          body: logEntry,
          refresh: true, // Make document searchable immediately
        });
      } catch (error) {
        console.error('Error writing log to OpenSearch:', error);
      } finally {
        callback();
      }
    });
  }
}

let openSearchClientInstance: Client | null = null;

try {
  // Only override node if explicitly provided in env
  const clientConfig: Partial<OpenSearchConfig> = {
    auth: { username: process.env.ES_USER || 'admin', password: process.env.ES_PASS || 'admin' },
    ssl: { rejectUnauthorized: process.env.NODE_ENV === 'production' },
  };
  
  if (process.env.ES_NODE) {
    clientConfig.node = process.env.ES_NODE;
  }

  openSearchClientInstance = createOpenSearchClient(clientConfig);
} catch (error) {
  console.error('Failed to create OpenSearch client for logger:', error);
  // Don't exit in test environment
  if (process.env.NODE_ENV !== 'test') {
    process.exit(1);
  }
}

// Prepare transports
const transports: winston.transport[] = [
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple() // Simple format for console output
    ),
  }),
];

// Only add OpenSearch transport if client was successfully created
if (openSearchClientInstance) {
  transports.push(new OpenSearchTransport({
    client: openSearchClientInstance,
    level: 'info', // Log all levels info and above to OpenSearch
  }));
}

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }), // Include stack trace
    winston.format.json() // Log in JSON format for OpenSearch
  ),
  defaultMeta: { service: 'device-inventory-api-ts' },
  transports,
});
