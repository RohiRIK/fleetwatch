#!/usr/bin/env node
/**
 * Create Compliance Indices Script
 *
 * Purpose: Create the new compliance_policies and compliance_evaluations
 * indices with proper mappings and ILM policies.
 *
 * Usage:
 *   bun run api-ts/src/scripts/create-compliance-indices.ts [--force]
 *
 * Options:
 *   --force  Delete existing indices and recreate (DANGEROUS - data loss!)
 */

import { createOpenSearchClient, INDICES, indexExists } from '../config/opensearch';
import {
  compliancePoliciesMapping,
  complianceEvaluationsMapping
} from '../schemas/device.schema';

const FORCE = process.argv.includes('--force');

// ============================================================================
// Main Execution
// ============================================================================

async function main() {
  console.log('🚀 Create Compliance Indices Script');
  console.log('====================================\n');

  const client = createOpenSearchClient();

  try {
    // Check OpenSearch health
    const health = await client.cluster.health();
    console.log(`📊 OpenSearch Status: ${health.body.status}`);
    console.log(`   Nodes: ${health.body.number_of_nodes}`);
    console.log(`   Data Nodes: ${health.body.number_of_data_nodes}\n`);

    // ========================================================================
    // 1. Create compliance_policies index
    // ========================================================================

    console.log('📦 Creating compliance_policies index...');

    const policiesExists = await indexExists(client, INDICES.COMPLIANCE_POLICIES);

    if (policiesExists && !FORCE) {
      console.log(`   ⚠️  Index ${INDICES.COMPLIANCE_POLICIES} already exists`);
      console.log('   Use --force to delete and recreate (DANGEROUS!)');
    } else if (policiesExists && FORCE) {
      console.log(`   🗑️  Deleting existing index: ${INDICES.COMPLIANCE_POLICIES}`);
      await client.indices.delete({ index: INDICES.COMPLIANCE_POLICIES });
      console.log('   ✅ Index deleted');
    }

    if (!policiesExists || FORCE) {
      await client.indices.create({
        index: INDICES.COMPLIANCE_POLICIES,
        body: {
          settings: {
            number_of_shards: 1,
            number_of_replicas: 1,
            refresh_interval: '30s',
            'index.mapping.nested_objects.limit': 50
          },
          mappings: compliancePoliciesMapping
        }
      });

      console.log(`   ✅ Index ${INDICES.COMPLIANCE_POLICIES} created successfully`);
    }

    // Verify index
    const policiesStats = await client.indices.stats({ index: INDICES.COMPLIANCE_POLICIES });
    console.log(`   📊 Index stats:`);
    console.log(`      - Primary shards: ${policiesStats.body._shards.total}`);
    console.log(`      - Documents: ${policiesStats.body._all.primaries.docs.count}`);
    console.log(`      - Size: ${policiesStats.body._all.primaries.store.size_in_bytes} bytes\n`);

    // ========================================================================
    // 2. Create compliance_evaluations index with 30-day retention
    // ========================================================================

    console.log('📦 Creating compliance_evaluations index...');

    const evaluationsExists = await indexExists(client, INDICES.COMPLIANCE_EVALUATIONS);

    if (evaluationsExists && !FORCE) {
      console.log(`   ⚠️  Index ${INDICES.COMPLIANCE_EVALUATIONS} already exists`);
      console.log('   Use --force to delete and recreate (DANGEROUS!)');
    } else if (evaluationsExists && FORCE) {
      console.log(`   🗑️  Deleting existing index: ${INDICES.COMPLIANCE_EVALUATIONS}`);
      await client.indices.delete({ index: INDICES.COMPLIANCE_EVALUATIONS });
      console.log('   ✅ Index deleted');
    }

    if (!evaluationsExists || FORCE) {
      // Create ILM policy for 30-day retention (user preference)
      console.log('   📋 Creating ILM policy for compliance evaluations...');

      const policyName = 'compliance_evaluations_30d_retention';

      try {
        await client.transport.request({
          method: 'PUT',
          path: `/_plugins/_ism/policies/${policyName}`,
          body: {
            policy: {
              description: '30-day retention policy for compliance evaluations',
              default_state: 'hot',
              states: [
                {
                  name: 'hot',
                  actions: [],
                  transitions: [
                    {
                      state_name: 'delete',
                      conditions: {
                        min_index_age: '30d'
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
        index: INDICES.COMPLIANCE_EVALUATIONS,
        body: {
          settings: {
            number_of_shards: 2, // More shards for time-series data
            number_of_replicas: 1,
            refresh_interval: '30s',
            'index.mapping.nested_objects.limit': 100,
            'opendistro.index_state_management.policy_id': policyName
          },
          mappings: complianceEvaluationsMapping
        }
      });

      console.log(`   ✅ Index ${INDICES.COMPLIANCE_EVALUATIONS} created successfully`);
    }

    // Verify index
    const evaluationsStats = await client.indices.stats({ index: INDICES.COMPLIANCE_EVALUATIONS });
    console.log(`   📊 Index stats:`);
    console.log(`      - Primary shards: ${evaluationsStats.body._shards.total}`);
    console.log(`      - Documents: ${evaluationsStats.body._all.primaries.docs.count}`);
    console.log(`      - Size: ${evaluationsStats.body._all.primaries.store.size_in_bytes} bytes\n`);

    // ========================================================================
    // 3. Summary
    // ========================================================================

    console.log('✅ Compliance indices created successfully!\n');

    console.log('📋 Next Steps:');
    console.log('   1. Verify indices exist:');
    console.log('      curl -k "https://localhost:9200/compliance_policies/_count"');
    console.log('      curl -k "https://localhost:9200/compliance_evaluations/_count"');
    console.log('\n   2. Test ComplianceRepository:');
    console.log('      # Add test code to verify upsert operations');
    console.log('\n   3. Proceed with Phase 2 (dual-write mode) implementation:');
    console.log('      # Update device-normalizer.ts to populate compliance references');

  } catch (error: any) {
    console.error('\n❌ Failed to create compliance indices:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run script
main();
