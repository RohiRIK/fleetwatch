// OpenSearch Client Configuration
import { Client } from '@opensearch-project/opensearch';
import type { ClientOptions } from '@opensearch-project/opensearch';

export interface OpenSearchConfig {
  node: string;
  auth?: {
    username: string;
    password: string;
  };
  ssl?: {
    rejectUnauthorized: boolean;
  };
  requestTimeout?: number;
  maxRetries?: number;
  compression?: boolean;
}

/**
 * Create OpenSearch client from environment variables
 */
export function createOpenSearchClient(config?: Partial<OpenSearchConfig>): Client {
  const defaultConfig: OpenSearchConfig = {
    node: process.env.ES_NODE || 'https://localhost:9200',
    auth: {
      username: process.env.ES_USER || 'admin',
      password: process.env.ES_PASS || 'admin'
    },
    ssl: {
      rejectUnauthorized: process.env.NODE_ENV === 'production'
    },
    requestTimeout: 60000, // 60 seconds
    maxRetries: 3,
    compression: true
  };

  const finalConfig = { ...defaultConfig, ...config };

  const clientOptions: ClientOptions = {
    node: finalConfig.node,
    auth: finalConfig.auth,
    ssl: finalConfig.ssl,
    requestTimeout: finalConfig.requestTimeout,
    maxRetries: finalConfig.maxRetries,
    compression: finalConfig.compression ? 'gzip' : undefined
  };

  return new Client(clientOptions);
}

/**
 * Index configuration
 */
export const INDICES = {
  DEVICES: 'devices_v2',
  USERS: 'users_v1',
  LICENSES: 'licenses_v1',
  ALERTS: 'alerts',
  METRICS: 'metrics',
  CONFIGURATION_PROFILES: 'configuration_profiles',
  DEPLOYMENT_HISTORY: 'configuration_deployment_history',
  COMPLIANCE_POLICIES: 'compliance_policies',
  COMPLIANCE_EVALUATIONS: 'compliance_evaluations',
  LOGS: 'system-logs', // New log index
  METADATA: 'system_metadata', // New metadata index
  ONBOARDING_STATUS: 'onboarding_status', // New onboarding status index
  PLATFORM_USERS: 'platform_users_v1', // New platform users index
  INTEGRATIONS: 'integrations_v1', // New integrations index
  CONDITIONAL_ACCESS_POLICIES: 'conditional_access_policies', // New conditional access policies index
  DETECTED_APPS: 'detected_apps', // New detected apps index
  EXPERIENCE_METRICS: 'experience_metrics',
  EXPERIENCE_EVENTS: 'experience_events'
} as const;

/**
 * Index aliases for backward compatibility
 */
export const ALIASES = {
  DEVICES: 'devices',
  USERS: 'users',
  LICENSES: 'licenses'
} as const;

/**
 * Check if OpenSearch is available
 */
export async function checkOpenSearchHealth(client: Client): Promise<boolean> {
  try {
    const response = await client.cluster.health();
    return response.body.status === 'green' || response.body.status === 'yellow';
  } catch (error) {
    console.error('OpenSearch health check failed:', error);
    return false;
  }
}

/**
 * Check if index exists
 */
export async function indexExists(client: Client, indexName: string): Promise<boolean> {
  try {
    const response = await client.indices.exists({ index: indexName });
    return response.statusCode === 200;
  } catch (error) {
    return false;
  }
}

/**
 * Create index with mapping
 */
export async function createIndex(
  client: Client,
  indexName: string,
  mapping: any,
  settings?: any
): Promise<boolean> {
  try {
    const exists = await indexExists(client, indexName);
    if (exists) {
      console.log(`Index ${indexName} already exists`);
      return true;
    }

    await client.indices.create({
      index: indexName,
      body: {
        settings: settings || {
          number_of_shards: 1,
          number_of_replicas: 1,
          refresh_interval: '5s'
        },
        mappings: mapping
      }
    });

    console.log(`Index ${indexName} created successfully`);
    return true;
  } catch (error) {
    console.error(`Failed to create index ${indexName}:`, error);
    return false;
  }
}

/**
 * Create or update index alias
 */
export async function createAlias(
  client: Client,
  indexName: string,
  aliasName: string
): Promise<boolean> {
  try {
    await client.indices.putAlias({
      index: indexName,
      name: aliasName
    });

    console.log(`Alias ${aliasName} -> ${indexName} created successfully`);
    return true;
  } catch (error) {
    console.error(`Failed to create alias ${aliasName} -> ${indexName}:`, error);
    return false;
  }
}

/**
 * Bootstrap indices - create all required indices and aliases
 */
export async function bootstrapIndices(client: Client): Promise<void> {
  console.log('Bootstrapping OpenSearch indices...');

  // Import mappings
  const { deviceMapping } = await import('../schemas/device.schema');
  const { userMapping } = await import('../schemas/user.schema');
  const { logMapping } = await import('../schemas/log.schema');
  const { licenseMapping } = await import('../schemas/license.schema');
  const { configurationProfileMapping } = await import('../schemas/configuration.schema');
  const { compliancePoliciesMapping, complianceEvaluationsMapping } = await import('../schemas/device.schema');
  const { metadataMapping } = await import('../schemas/metadata.schema');
  const { onboardingStatusMapping } = await import('../schemas/onboarding-status.schema');
  const { platformUserMapping } = await import('../schemas/platform-user.schema');
  const { integrationMapping } = await import('../schemas/integration.schema');
  const { conditionalAccessPolicyMapping } = await import('../schemas/conditional-access.schema');
  const { experienceMetricsMapping, experienceEventsMapping } = await import('../schemas/analytics.schema');

  // 1. Create DEVICES index (Limit increased to 10000)
  await createIndex(client, INDICES.DEVICES, deviceMapping, {
    number_of_shards: 2,
    number_of_replicas: 1,
    refresh_interval: '5s',
    index: {
      mapping: {
        nested_objects: {
          limit: 10000 // Fix for "limit of [200] exceeded"
        }
      }
    }
  });

  // 2. Create USERS index (Limit increased to 10000)
  await createIndex(client, INDICES.USERS, userMapping, {
    number_of_shards: 1,
    number_of_replicas: 1,
    refresh_interval: '5s',
    index: {
      mapping: {
        nested_objects: {
          limit: 10000 // Fix for "limit of [200] exceeded"
        }
      }
    }
  });

  // 3. Create LICENSES index
  await createIndex(client, INDICES.LICENSES, licenseMapping, {
    number_of_shards: 1,
    number_of_replicas: 1,
    refresh_interval: '5s'
  });

  // 4. Create LOGS index
  await createIndex(client, INDICES.LOGS, logMapping, {
    number_of_shards: 1,
    number_of_replicas: 1,
    refresh_interval: '5s'
  });

  // 5. Create CONFIGURATION_PROFILES index (with keyword mapping for config_id)
  await createIndex(client, INDICES.CONFIGURATION_PROFILES, configurationProfileMapping, {
    number_of_shards: 1,
    number_of_replicas: 1,
    refresh_interval: '5s'
  });

  // 6. Create COMPLIANCE_POLICIES index (with keyword mapping for policy_id)
  await createIndex(client, INDICES.COMPLIANCE_POLICIES, compliancePoliciesMapping, {
    number_of_shards: 1,
    number_of_replicas: 1,
    refresh_interval: '5s'
  });

  // 7. Create COMPLIANCE_EVALUATIONS index (time-series data)
  await createIndex(client, INDICES.COMPLIANCE_EVALUATIONS, complianceEvaluationsMapping, {
    number_of_shards: 1,
    number_of_replicas: 1,
    refresh_interval: '5s'
  });

  // 8. Create METADATA index
  await createIndex(client, INDICES.METADATA, metadataMapping, {
    number_of_shards: 1,
    number_of_replicas: 1,
    refresh_interval: '1s' // Fast refresh for status updates
  });

  // 9. Create ONBOARDING_STATUS index
  await createIndex(client, INDICES.ONBOARDING_STATUS, onboardingStatusMapping, {
    number_of_shards: 1,
    number_of_replicas: 1,
    refresh_interval: '1s' // Fast refresh for status updates
  });

  // 10. Create PLATFORM_USERS index
  await createIndex(client, INDICES.PLATFORM_USERS, platformUserMapping, {
    number_of_shards: 1,
    number_of_replicas: 1,
    refresh_interval: '1s'
  });

  // 11. Create INTEGRATIONS index
  await createIndex(client, INDICES.INTEGRATIONS, integrationMapping, {
    number_of_shards: 1,
    number_of_replicas: 1,
    refresh_interval: '1s'
  });

  // 12. Create CONDITIONAL_ACCESS_POLICIES index
  await createIndex(client, INDICES.CONDITIONAL_ACCESS_POLICIES, conditionalAccessPolicyMapping, {
    number_of_shards: 1,
    number_of_replicas: 1,
    refresh_interval: '5s'
  });

  // 13. Create EXPERIENCE_METRICS index
  await createIndex(client, INDICES.EXPERIENCE_METRICS, experienceMetricsMapping, {
    number_of_shards: 1,
    number_of_replicas: 1,
    refresh_interval: '5s'
  });

  // 14. Create EXPERIENCE_EVENTS index
  await createIndex(client, INDICES.EXPERIENCE_EVENTS, experienceEventsMapping, {
    number_of_shards: 1,
    number_of_replicas: 1,
    refresh_interval: '5s'
  });

  // Create aliases
  await createAlias(client, INDICES.DEVICES, ALIASES.DEVICES);
  await createAlias(client, INDICES.USERS, ALIASES.USERS);
  await createAlias(client, INDICES.LICENSES, ALIASES.LICENSES);

  console.log('Index bootstrap complete');
}
/**
 * Bulk indexing configuration
 */
export const BULK_CONFIG = {
  BATCH_SIZE: 500, // Documents per batch
  FLUSH_INTERVAL: 5000, // Flush interval in ms
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000 // Initial retry delay in ms
} as const;

/**
 * Refresh index to make documents searchable immediately
 */
export async function refreshIndex(client: Client, indexName: string): Promise<void> {
  try {
    await client.indices.refresh({ index: indexName });
    console.log(`Index ${indexName} refreshed`);
  } catch (error) {
    console.error(`Failed to refresh index ${indexName}:`, error);
  }
}

/**
 * Get index stats
 */
export async function getIndexStats(client: Client, indexName: string): Promise<any> {
  try {
    const response = await client.indices.stats({ index: indexName });
    return response.body;
  } catch (error) {
    console.error(`Failed to get stats for index ${indexName}:`, error);
    return null;
  }
}
