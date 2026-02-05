#!/usr/bin/env bun
/**
 * Setup Log Retention & Index Templates Script
 * 
 * Purpose:
 * 1. Create the ISM policy for 7-day retention.
 * 2. Create index templates for logs-system-*, logs-user-*, and logs-entra-*. 
 * 
 * Usage:
 *   docker compose exec api-ts bun run scripts/setup-log-retention.ts
 */

import { Client } from '@opensearch-project/opensearch';

// Create OpenSearch client from environment variables
const client = new Client({
  node: process.env.ES_NODE || 'https://localhost:9200',
  auth: {
    username: process.env.ES_USER || 'admin',
    password: process.env.ES_PASS || 'admin'
  },
  ssl: {
    rejectUnauthorized: false // For local development
  }
});

const POLICY_NAME = 'logs_retention_policy';

async function setupISMPolicy() {
  console.log(`📦 Creating ISM policy: ${POLICY_NAME}...`);
  
  try {
    await client.transport.request({
      method: 'PUT',
      path: `/_plugins/_ism/policies/${POLICY_NAME}`,
      body: {
        policy: {
          description: '7-day retention policy for all log indices',
          default_state: 'hot',
          states: [
            {
              name: 'hot',
              actions: [],
              transitions: [
                {
                  state_name: 'delete',
                  conditions: {
                    min_index_age: '7d'
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
    console.log('✅ ISM policy created successfully.');
  } catch (error: any) {
    if (error.statusCode === 409) {
      console.log('ℹ️ ISM policy already exists.');
    } else {
      console.error('❌ Failed to create ISM policy:', error.message);
      throw error;
    }
  }
}

async function setupIndexTemplates() {
  console.log('📦 Creating index templates...');

  const templates = [
    {
      name: 'logs-system-template',
      index_patterns: ['logs-system-*'],
      mappings: {
        properties: {
          timestamp: { type: 'date' },
          severity: { type: 'keyword' },
          service: { type: 'keyword' },
          message: { type: 'text' },
          user: { type: 'keyword' },
          metadata: { type: 'object', enabled: false }
        }
      }
    },
    {
      name: 'logs-user-template',
      index_patterns: ['logs-user-*'],
      mappings: {
        properties: {
          timestamp: { type: 'date' },
          user_upn: { type: 'keyword' },
          action: { type: 'keyword' },
          resource_id: { type: 'keyword' },
          ip_address: { type: 'ip' },
          user_agent: { type: 'text' },
          metadata: { type: 'object' }
        }
      }
    },
    {
      name: 'logs-entra-template',
      index_patterns: ['logs-entra-*'],
      mappings: {
        properties: {
          timestamp: { type: 'date' },
          category: { type: 'keyword' },
          user_upn: { type: 'keyword' },
          app_name: { type: 'keyword' },
          ip_address: { type: 'ip' },
          status: { type: 'keyword' },
          result_description: { type: 'text' },
          details: { type: 'object' }
        }
      }
    }
  ];

  for (const template of templates) {
    console.log(`   Creating template: ${template.name}...`);
    try {
      await client.indices.putIndexTemplate({
        name: template.name,
        body: {
          index_patterns: template.index_patterns,
          priority: 100,
          template: {
            settings: {
              number_of_shards: 1,
              number_of_replicas: 1,
              'opendistro.index_state_management.policy_id': POLICY_NAME
            },
            mappings: template.mappings
          }
        }
      });
      console.log(`   ✅ Template ${template.name} created.`);
    } catch (error: any) {
      console.error(`   ❌ Failed to create template ${template.name}:`, error.message);
      throw error;
    }
  }
}

async function main() {
  console.log('🚀 Starting OpenSearch Log Setup...');
  try {
    await setupISMPolicy();
    await setupIndexTemplates();
    console.log('\n✅ Setup complete! Log indices will now follow the 7-day retention policy.');
  } catch (error) {
    process.exit(1);
  }
}

main();
