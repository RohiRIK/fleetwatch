#!/usr/bin/env node
/**
 * Create Configuration Indices Script
 *
 * Purpose: Create the new configuration_profiles and configuration_deployment_history
 * indices with proper mappings and ILM policies.
 *
 * Usage:
 *   bun run api-ts/src/scripts/create-configuration-indices.ts [--force]
 *
 * Options:
 *   --force  Delete existing indices and recreate (DANGEROUS - data loss!)
 */

import { createOpenSearchClient, INDICES, indexExists } from '../config/opensearch';
import {
  configurationProfilesMapping,
  deploymentHistoryMapping
} from '../schemas/device.schema';

const FORCE = process.argv.includes('--force');

// ============================================================================
// Main Execution
// ============================================================================

async function main() {
  console.log('🚀 Create Configuration Indices Script');
  console.log('======================================\n');

  const client = createOpenSearchClient();

  try {
    // Check OpenSearch health
    const health = await client.cluster.health();
    console.log(`📊 OpenSearch Status: ${health.body.status}`);
    console.log(`   Nodes: ${health.body.number_of_nodes}`);
    console.log(`   Data Nodes: ${health.body.number_of_data_nodes}\n`);

    // ========================================================================
    // 1. Create configuration_profiles index
    // ========================================================================

    console.log('📦 Creating configuration_profiles index...');

    const profilesExists = await indexExists(client, INDICES.CONFIGURATION_PROFILES);

    if (profilesExists && !FORCE) {
      console.log(`   ⚠️  Index ${INDICES.CONFIGURATION_PROFILES} already exists`);
      console.log('   Use --force to delete and recreate (DANGEROUS!)');
    } else if (profilesExists && FORCE) {
      console.log(`   🗑️  Deleting existing index: ${INDICES.CONFIGURATION_PROFILES}`);
      await client.indices.delete({ index: INDICES.CONFIGURATION_PROFILES });
      console.log('   ✅ Index deleted');
    }

    if (!profilesExists || FORCE) {
      await client.indices.create({
        index: INDICES.CONFIGURATION_PROFILES,
        body: {
          settings: {
            number_of_shards: 1,
            number_of_replicas: 1,
            refresh_interval: '30s',
            'index.mapping.nested_objects.limit': 50
          },
          mappings: configurationProfilesMapping
        }
      });

      console.log(`   ✅ Index ${INDICES.CONFIGURATION_PROFILES} created successfully`);
    }

    // Verify index
    const profilesStats = await client.indices.stats({ index: INDICES.CONFIGURATION_PROFILES });
    console.log(`   📊 Index stats:`);
    console.log(`      - Primary shards: ${profilesStats.body._shards.total}`);
    console.log(`      - Documents: ${profilesStats.body._all.primaries.docs.count}`);
    console.log(`      - Size: ${profilesStats.body._all.primaries.store.size_in_bytes} bytes\n`);

    // ========================================================================
    // 2. Create configuration_deployment_history index
    // ========================================================================

    console.log('📦 Creating configuration_deployment_history index...');

    const historyExists = await indexExists(client, INDICES.DEPLOYMENT_HISTORY);

    if (historyExists && !FORCE) {
      console.log(`   ⚠️  Index ${INDICES.DEPLOYMENT_HISTORY} already exists`);
      console.log('   Use --force to delete and recreate (DANGEROUS!)');
    } else if (historyExists && FORCE) {
      console.log(`   🗑️  Deleting existing index: ${INDICES.DEPLOYMENT_HISTORY}`);
      await client.indices.delete({ index: INDICES.DEPLOYMENT_HISTORY });
      console.log('   ✅ Index deleted');
    }

    if (!historyExists || FORCE) {
      // Create ILM policy for 90-day retention
      console.log('   📋 Creating ILM policy for deployment history...');

      const policyName = 'deployment_history_90d_retention';

      try {
        await client.transport.request({
          method: 'PUT',
          path: `/_plugins/_ism/policies/${policyName}`,
          body: {
            policy: {
              description: '90-day retention policy for deployment history',
              default_state: 'hot',
              states: [
                {
                  name: 'hot',
                  actions: [],
                  transitions: [
                    {
                      state_name: 'delete',
                      conditions: {
                        min_index_age: '90d'
                      }
                    }
                  ]
                },
                {
                  name: 'delete',
                  actions: [
                    {
                      delete: {}
                    }
                  ],
                  transitions: []
                }
              ]
            }
          }
        });

        console.log(`   ✅ ILM policy ${policyName} created`);
      } catch (error: any) {
        if (error.statusCode === 409) {
          console.log(`   ℹ️  ILM policy ${policyName} already exists`);
        } else {
          console.warn(`   ⚠️  Failed to create ILM policy: ${error.message}`);
          console.warn('   Continuing without ILM policy - manual deletion required');
        }
      }

      // Create index
      await client.indices.create({
        index: INDICES.DEPLOYMENT_HISTORY,
        body: {
          settings: {
            number_of_shards: 2, // More shards for time-series data
            number_of_replicas: 1,
            refresh_interval: '30s',
            'index.mapping.nested_objects.limit': 100,
            'opendistro.index_state_management.policy_id': policyName
          },
          mappings: deploymentHistoryMapping
        }
      });

      console.log(`   ✅ Index ${INDICES.DEPLOYMENT_HISTORY} created successfully`);
    }

    // Verify index
    const historyStats = await client.indices.stats({ index: INDICES.DEPLOYMENT_HISTORY });
    console.log(`   📊 Index stats:`);
    console.log(`      - Primary shards: ${historyStats.body._shards.total}`);
    console.log(`      - Documents: ${historyStats.body._all.primaries.docs.count}`);
    console.log(`      - Size: ${historyStats.body._all.primaries.store.size_in_bytes} bytes\n`);

    // ========================================================================
    // 3. Summary
    // ========================================================================

    console.log('✅ Configuration indices created successfully!\n');

    console.log('📋 Next Steps:');
    console.log('   1. Run backfill script to populate configuration_profiles:');
    console.log('      bun run api-ts/src/scripts/backfill-configuration-profiles.ts --dry-run');
    console.log('      bun run api-ts/src/scripts/backfill-configuration-profiles.ts');
    console.log('\n   2. Verify data:');
    console.log('      curl -k "https://localhost:9200/configuration_profiles/_count"');
    console.log('      curl -k "https://localhost:9200/configuration_deployment_history/_count"');
    console.log('\n   3. Proceed with Phase 2 (dual-write mode) implementation');

  } catch (error: any) {
    console.error('\n❌ Failed to create configuration indices:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run script
main();
