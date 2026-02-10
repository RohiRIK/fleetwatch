import { syncUsers } from '@/lib/services/userSync';
import { syncDevices } from '@/lib/services/deviceSync';

console.log('🚀 Running Phase 2 data sync...\n');
console.log('This will populate the new columns with data from Azure AD.\n');

try {
  // Sync users first
  console.log('👥 Syncing users...');
  const userResult = await syncUsers();
  
  console.log('\n✅ User sync completed:');
  console.log(`   - Processed: ${userResult.usersProcessed}`);
  console.log(`   - Created: ${userResult.usersCreated}`);
  console.log(`   - Updated: ${userResult.usersUpdated}`);
  console.log(`   - Failed: ${userResult.usersFailed}`);
  console.log(`   - Duration: ${userResult.durationMs}ms\n`);
  
  // Sync devices
  console.log('💻 Syncing devices (full mode)...');
  const deviceResult = await syncDevices('full');
  
  console.log('\n✅ Device sync completed:');
  console.log(`   - Processed: ${deviceResult.devicesProcessed}`);
  console.log(`   - Created: ${deviceResult.devicesCreated}`);
  console.log(`   - Updated: ${deviceResult.devicesUpdated}`);
  console.log(`   - Failed: ${deviceResult.devicesFailed}`);
  console.log(`   - Duration: ${deviceResult.durationMs}ms\n`);
  
  console.log('🎉 Phase 2 data sync complete!\n');
  console.log('📊 Next steps:');
  console.log('   - Run performance benchmarks');
  console.log('   - Verify new columns populated');
  console.log('   - Check query plans use indexes\n');
  
} catch (error) {
  console.error('❌ Sync failed:', error);
  process.exit(1);
}
