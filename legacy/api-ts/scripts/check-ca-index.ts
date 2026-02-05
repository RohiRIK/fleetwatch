import { Client } from '@opensearch-project/opensearch';

const client = new Client({
  node: 'http://opensearch:9200',
  auth: { username: 'admin', password: 'admin' },
  ssl: { rejectUnauthorized: false }
});

async function check() {
  try {
    const exists = await client.indices.exists({ index: 'conditional_access_policies' });
    console.log(`Index exists: ${exists.body}`);
    if (exists.body) {
      const count = await client.count({ index: 'conditional_access_policies' });
      console.log(`Document count: ${count.body.count}`);
    }
  } catch (e) {
    console.error(e);
  }
}
check();
