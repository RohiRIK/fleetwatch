#!/usr/bin/env node
/**
 * Backfill Script: Extract Configuration Profiles from Device Documents
 *
 * Purpose: Populate the new `configuration_profiles` index from existing nested
 * configuration data in device documents.
 *
 * Strategy:
 * 1. Scan all devices in the `devices` index
 * 2. Extract unique configuration profiles from device.configuration.policies
 * 3. Calculate content hash for each profile to prevent duplicates
 * 4. Create versioned profile documents in `configuration_profiles` index
 * 5. Mark profiles as active if referenced by any device
 *
 * Usage:
 *   bun run api-ts/src/scripts/backfill-configuration-profiles.ts [--dry-run] [--batch-size=100]
 */

import { Client } from '@opensearch-project/opensearch';
import { createHash } from 'crypto';
import { INDICES } from '../config/opensearch';
import type {
  ConfigurationProfile,
  ConfigurationSettings,
  ConfigPlatform
} from '../schemas/device.schema';

// ============================================================================
// Configuration
// ============================================================================

const DRY_RUN = process.argv.includes('--dry-run');
const BATCH_SIZE = parseInt(process.argv.find(arg => arg.startsWith('--batch-size='))?.split('=')[1] || '100');
const SCROLL_TIMEOUT = '5m';

// ============================================================================
// OpenSearch Client
// ============================================================================

const client = new Client({
  node: process.env.ES_NODE || 'https://localhost:9200',
  auth: {
    username: process.env.ES_USER || 'admin',
    password: process.env.ES_PASS || 'admin'
  },
  ssl: {
    rejectUnauthorized: false
  }
});

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Calculate SHA256 hash of settings payload for content-based versioning
 */
function calculateContentHash(settingsPayload: ConfigurationSettings): string {
  const canonical = JSON.stringify(settingsPayload, Object.keys(settingsPayload).sort());
  return createHash('sha256').update(canonical).digest('hex');
}

/**
 * Normalize platform string to standard format
 */
function normalizePlatform(platformType: string): ConfigPlatform {
  const lower = platformType.toLowerCase();
  if (lower.includes('windows')) return 'windows';
  if (lower.includes('macos')) return 'macOS';
  if (lower.includes('ios') && !lower.includes('macos')) return 'iOS';
  if (lower.includes('android')) return 'android';
  if (lower.includes('linux')) return 'linux';
  return 'windows'; // Default fallback
}

/**
 * Extract unique configuration profiles from device documents
 */
interface ExtractedProfile {
  config_id: string;
  display_name: string;
  platform: ConfigPlatform;
  settings: any;
  created_date?: string;
  last_modified_date?: string;
  content_hash: string;
  referenced_by_devices: Set<string>;
}

async function extractProfilesFromDevices(): Promise<Map<string, ExtractedProfile>> {
  console.log('📊 Scanning device documents for configuration profiles...');

  const profiles = new Map<string, ExtractedProfile>();
  let processedDevices = 0;
  let totalProfiles = 0;

  // Initialize scroll search
  let response = await client.search({
    index: INDICES.DEVICES,
    scroll: SCROLL_TIMEOUT,
    size: BATCH_SIZE,
    body: {
      query: {
        bool: {
          must: [
            { exists: { field: 'configuration.policies' } }
          ]
        }
      },
      _source: ['id', 'configuration.policies']
    }
  });

  let scrollId = response.body._scroll_id;
  let hits = response.body.hits.hits;

  // Process batches
  while (hits.length > 0) {
    for (const hit of hits) {
      const device = hit._source;
      const deviceId = device.id;
      const policies = device.configuration?.policies || [];

      processedDevices++;

      for (const policy of policies) {
        if (!policy.id || !policy.name) continue;

        const configId = policy.id;
        const contentHash = calculateContentHash(policy.settings || {});

        // Check if we've seen this exact profile version before
        const existingProfile = profiles.get(configId);

        if (existingProfile) {
          // Add device reference
          existingProfile.referenced_by_devices.add(deviceId);

          // If content hash differs, we need versioning (should be handled in ingestion)
          if (existingProfile.content_hash !== contentHash) {
            console.warn(`⚠️  Profile ${configId} has different content hash across devices`);
            console.warn(`   Existing: ${existingProfile.content_hash.substring(0, 8)}...`);
            console.warn(`   New:      ${contentHash.substring(0, 8)}...`);
          }
        } else {
          // New profile
          profiles.set(configId, {
            config_id: configId,
            display_name: policy.name,
            platform: normalizePlatform(policy.platformType || 'windows'),
            settings: policy.settings || {},
            created_date: policy.createdDateTime,
            last_modified_date: policy.lastModifiedDateTime,
            content_hash: contentHash,
            referenced_by_devices: new Set([deviceId])
          });
          totalProfiles++;
        }
      }
    }

    // Log progress
    if (processedDevices % 500 === 0) {
      console.log(`   Processed ${processedDevices} devices, found ${totalProfiles} unique profiles`);
    }

    // Get next batch
    response = await client.scroll({
      scroll_id: scrollId,
      scroll: SCROLL_TIMEOUT
    });

    scrollId = response.body._scroll_id;
    hits = response.body.hits.hits;
  }

  // Clear scroll
  await client.clearScroll({ scroll_id: scrollId });

  console.log(`✅ Extraction complete:`);
  console.log(`   - Devices processed: ${processedDevices}`);
  console.log(`   - Unique profiles: ${totalProfiles}`);

  return profiles;
}

/**
 * Create configuration_profiles index with proper mapping
 */
async function createConfigurationProfilesIndex(): Promise<void> {
  const indexName = 'configuration_profiles';

  console.log(`📦 Creating index: ${indexName}`);

  try {
    const exists = await client.indices.exists({ index: indexName });
    if (exists.body) {
      console.log(`   Index ${indexName} already exists`);
      return;
    }

    await client.indices.create({
      index: indexName,
      body: {
        settings: {
          number_of_shards: 1,
          number_of_replicas: 1,
          refresh_interval: '30s'
        },
        mappings: {
          properties: {
            config_id: { type: 'keyword' },
            version: { type: 'integer' },
            content_hash: { type: 'keyword' },
            display_name: {
              type: 'text',
              fields: { keyword: { type: 'keyword' } }
            },
            description: { type: 'text' },
            platform: { type: 'keyword' },
            settings_payload: {
              type: 'object',
              enabled: false
            },
            created_date: { type: 'date' },
            last_modified_date: { type: 'date' },
            is_active_reference: { type: 'boolean' },
            indexed_at: { type: 'date' }
          }
        }
      }
    });

    console.log(`✅ Index ${indexName} created successfully`);
  } catch (error: any) {
    console.error(`❌ Error creating index: ${error.message}`);
    throw error;
  }
}

/**
 * Bulk ingest profiles to configuration_profiles index
 */
async function ingestProfiles(profiles: Map<string, ExtractedProfile>): Promise<void> {
  console.log(`📝 Ingesting ${profiles.size} profiles to configuration_profiles index...`);

  if (DRY_RUN) {
    console.log('🔍 DRY RUN MODE - No data will be written');

    // Show sample profiles
    const samples = Array.from(profiles.values()).slice(0, 5);
    console.log('\n📋 Sample profiles:');
    for (const profile of samples) {
      console.log(`   - ${profile.config_id}`);
      console.log(`     Name: ${profile.display_name}`);
      console.log(`     Platform: ${profile.platform}`);
      console.log(`     Hash: ${profile.content_hash.substring(0, 16)}...`);
      console.log(`     Referenced by ${profile.referenced_by_devices.size} devices`);
    }
    return;
  }

  const indexedAt = new Date().toISOString();
  const bulkBody: any[] = [];

  for (const profile of profiles.values()) {
    const docId = `${profile.config_id}-v1`; // Initial version is always v1

    const doc: ConfigurationProfile = {
      config_id: profile.config_id,
      version: 1,
      content_hash: profile.content_hash,
      display_name: profile.display_name,
      platform: profile.platform,
      settings_payload: profile.settings,
      created_date: profile.created_date || indexedAt,
      last_modified_date: profile.last_modified_date || indexedAt,
      is_active_reference: profile.referenced_by_devices.size > 0,
      indexed_at: indexedAt
    };

    bulkBody.push({ index: { _index: 'configuration_profiles', _id: docId } });
    bulkBody.push(doc);
  }

  // Execute bulk operation
  const response = await client.bulk({
    body: bulkBody,
    refresh: true
  });

  if (response.body.errors) {
    const errors = response.body.items.filter((item: any) => item.index?.error);
    console.error(`❌ Bulk ingestion had ${errors.length} errors:`);
    errors.slice(0, 5).forEach((item: any) => {
      console.error(`   - ${item.index.error.type}: ${item.index.error.reason}`);
    });
    throw new Error('Bulk ingestion failed with errors');
  }

  console.log(`✅ Successfully ingested ${profiles.size} profiles`);
}

/**
 * Validate the backfill results
 */
async function validateBackfill(expectedCount: number): Promise<void> {
  console.log('\n🔍 Validating backfill results...');

  // Count documents in configuration_profiles
  const countResponse = await client.count({
    index: 'configuration_profiles'
  });

  const actualCount = countResponse.body.count;
  console.log(`   - Expected profiles: ${expectedCount}`);
  console.log(`   - Actual profiles: ${actualCount}`);

  if (actualCount !== expectedCount) {
    console.error(`❌ Validation failed: count mismatch`);
    throw new Error('Validation failed');
  }

  // Check for active references
  const activeResponse = await client.search({
    index: 'configuration_profiles',
    body: {
      size: 0,
      aggs: {
        active_count: {
          filter: { term: { is_active_reference: true } }
        },
        inactive_count: {
          filter: { term: { is_active_reference: false } }
        }
      }
    }
  });

  const activeCount = activeResponse.body.aggregations.active_count.doc_count;
  const inactiveCount = activeResponse.body.aggregations.inactive_count.doc_count;

  console.log(`   - Active profiles: ${activeCount}`);
  console.log(`   - Inactive profiles: ${inactiveCount}`);

  console.log('✅ Validation passed');
}

// ============================================================================
// Main Execution
// ============================================================================

async function main() {
  console.log('🚀 Configuration Profiles Backfill Script');
  console.log('==========================================\n');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Batch Size: ${BATCH_SIZE}\n`);

  try {
    // Step 1: Extract profiles from device documents
    const profiles = await extractProfilesFromDevices();

    if (profiles.size === 0) {
      console.log('⚠️  No configuration profiles found in device documents');
      return;
    }

    // Step 2: Create index (if not exists)
    if (!DRY_RUN) {
      await createConfigurationProfilesIndex();
    }

    // Step 3: Ingest profiles
    await ingestProfiles(profiles);

    // Step 4: Validate
    if (!DRY_RUN) {
      await validateBackfill(profiles.size);
    }

    console.log('\n✅ Backfill completed successfully!');

  } catch (error: any) {
    console.error('\n❌ Backfill failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run script
main();
