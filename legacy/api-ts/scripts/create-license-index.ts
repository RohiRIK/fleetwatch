// Create License Index Script
import { Client } from '@opensearch-project/opensearch';
import { licenseMapping } from '../src/schemas/license.schema';
import { INDICES } from '../src/config/opensearch';

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

async function createLicenseIndex() {
  try {
    console.log(`Creating index: ${INDICES.LICENSES}`);

    // Check if index exists
    const exists = await client.indices.exists({
      index: INDICES.LICENSES
    });

    if (exists.body) {
      console.log(`✅ Index ${INDICES.LICENSES} already exists`);
      return;
    }

    // Create index with mapping
    await client.indices.create({
      index: INDICES.LICENSES,
      body: {
        settings: {
          number_of_shards: 1,
          number_of_replicas: 1,
          refresh_interval: '5s',
          'index.mapping.total_fields.limit': 2000
        },
        mappings: licenseMapping
      }
    });

    console.log(`✅ Successfully created index: ${INDICES.LICENSES}`);
  } catch (error) {
    console.error('❌ Failed to create index:', error);
    throw error;
  } finally {
    await client.close();
  }
}

// Run the script
createLicenseIndex()
  .then(() => {
    console.log('Index creation complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Index creation failed:', error);
    process.exit(1);
  });
