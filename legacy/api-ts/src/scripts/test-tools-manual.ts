import { aiToolsService } from '../services/ai-tools.service';
import { createOpenSearchClient, INDICES } from '../config/opensearch';

async function test() {
  console.log('--- Manual Tool Verification ---');
  
  const client = createOpenSearchClient();
  const context = {
    opensearchClient: client,
    tenantId: 'manual-test',
    userId: 'manual-tester'
  };

  const registry = aiToolsService.getRegistry();

  console.log('1. Testing get_device_detail...');
  // Note: This might fail if ID doesn't exist, but we check execution
  try {
    const d = await registry.get_device_detail.execute({ deviceId: 'test-id' }, context);
    console.log('Result:', d);
  } catch (e) {
    console.error('Error:', e);
  }

  console.log('2. Testing count_devices...');
  try {
    const c = await registry.count_devices.execute({ os: 'Windows' }, context);
    console.log('Count (Windows):', c);
  } catch (e) {
    console.error('Error:', e);
  }

  process.exit(0);
}

test();
