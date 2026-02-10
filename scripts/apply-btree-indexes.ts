import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });

console.log('🚀 Applying B-tree indexes (Phase 2 - Part 2/3)...\n');

try {
  console.log('Creating idx_devices_is_compliant...');
  await sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_devices_is_compliant ON devices (is_compliant)`;
  console.log('✅ idx_devices_is_compliant created');

  console.log('Creating idx_devices_operating_system...');
  await sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_devices_operating_system ON devices (operating_system)`;
  console.log('✅ idx_devices_operating_system created');

  console.log('Creating idx_devices_jail_broken...');
  await sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_devices_jail_broken ON devices (jail_broken)`;
  console.log('✅ idx_devices_jail_broken created');

  console.log('Creating idx_devices_user_id...');
  await sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_devices_user_id ON devices (user_id)`;
  console.log('✅ idx_devices_user_id created');

  console.log('Creating idx_devices_compliance_grace...');
  await sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_devices_compliance_grace ON devices (compliance_grace_period_expiration)`;
  console.log('✅ idx_devices_compliance_grace created');

  console.log('Creating idx_devices_threat_state...');
  await sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_devices_threat_state ON devices (partner_reported_threat_state)`;
  console.log('✅ idx_devices_threat_state created');

  console.log('\n🎉 All 6 B-tree indexes created successfully!\n');
  
  // Verify indexes
  const indexes = await sql`
    SELECT indexname, tablename 
    FROM pg_indexes 
    WHERE tablename = 'devices' 
      AND indexname IN (
        'idx_devices_is_compliant',
        'idx_devices_operating_system',
        'idx_devices_jail_broken',
        'idx_devices_user_id',
        'idx_devices_compliance_grace',
        'idx_devices_threat_state'
      )
    ORDER BY indexname
  `;
  
  console.log('📊 Verification - Indexes created:');
  indexes.forEach(idx => {
    console.log(`   ✓ ${idx.indexname}`);
  });
  
} catch (error) {
  console.error('❌ Error creating indexes:', error);
  throw error;
} finally {
  await sql.end();
}
