/**
 * Test script to verify Winston logger is storing logs properly
 */
import { log } from '@/lib/logger/logger';

async function testLogger() {
  console.log('🧪 Testing Winston logger...\n');
  
  // Check initial state
  const initialLogs = await log.getAllLogs();
  console.log('Initial log count:', initialLogs.length);
  
  // Generate some test logs
  console.log('\n📝 Generating test logs...');
  log.info('Test info message', { context: 'TestScript' });
  log.warn('Test warning message', { context: 'TestScript' });
  log.error('Test error message', { 
    context: 'TestScript', 
    error: new Error('Test error') 
  });
  log.http('GET /api/test - 200', { 
    context: 'HTTP',
    metadata: { duration: 123, statusCode: 200 }
  });
  
  console.log('\n⏳ Waiting for async operations...\n');
  
  // Wait a bit for async operations to complete
  setTimeout(async () => {
    const logs = await log.getAllLogs();
    console.log(`📊 Total logs stored: ${logs.length}\n`);
    
    if (logs.length > 0) {
      console.log('✅ Logger is working! Stored logs:\n');
      logs.forEach((entry, i) => {
        console.log(`${i + 1}. [${entry.level.toUpperCase()}] ${entry.message}`);
        if (entry.context) console.log(`   Context: ${entry.context}`);
        if (entry.metadata) console.log(`   Metadata:`, entry.metadata);
        console.log(`   Timestamp: ${entry.timestamp}\n`);
      });
    } else {
      console.log('❌ No logs stored - logger transport not working');
      console.log('\nTroubleshooting:');
      console.log('- Check if InMemoryTransport.log() method is being called');
      console.log('- Verify Winston is routing logs to custom transports');
      console.log('- Check log level configuration\n');
    }
    
    process.exit(logs.length > 0 ? 0 : 1);
  }, 2000);
}

testLogger();
