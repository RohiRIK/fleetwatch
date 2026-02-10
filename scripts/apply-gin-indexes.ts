import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });

console.log('🚀 Applying GIN indexes on JSONB columns (Phase 2 - Part 3/3)...\n');
console.log('⏳ Note: GIN indexes may take 1-3 minutes for large datasets...\n');

try {
  console.log('Creating idx_devices_security_details (GIN on security_details JSONB)...');
  const start1 = Date.now();
  await sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_devices_security_details ON devices USING GIN (security_details)`;
  const duration1 = Date.now() - start1;
  console.log(`✅ idx_devices_security_details created (${duration1}ms)`);

  console.log('Creating idx_devices_detected_apps (GIN on detected_apps_details JSONB)...');
  const start2 = Date.now();
  await sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_devices_detected_apps ON devices USING GIN (detected_apps_details)`;
  const duration2 = Date.now() - start2;
  console.log(`✅ idx_devices_detected_apps created (${duration2}ms)`);

  console.log('Creating idx_devices_compliance_details (GIN on compliance_details JSONB)...');
  const start3 = Date.now();
  await sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_devices_compliance_details ON devices USING GIN (compliance_details)`;
  const duration3 = Date.now() - start3;
  console.log(`✅ idx_devices_compliance_details created (${duration3}ms)`);

  const totalDuration = duration1 + duration2 + duration3;
  console.log(`\n🎉 All 3 GIN indexes created successfully! (Total: ${totalDuration}ms)\n`);
  
  // Verify indexes
  const indexes = await sql`
    SELECT indexname, tablename 
    FROM pg_indexes 
    WHERE tablename = 'devices' 
      AND indexname IN (
        'idx_devices_security_details',
        'idx_devices_detected_apps',
        'idx_devices_compliance_details'
      )
    ORDER BY indexname
  `;
  
  console.log('📊 Verification - GIN indexes created:');
  indexes.forEach(idx => {
    console.log(`   ✓ ${idx.indexname}`);
  });
  
  // Check index sizes
  console.log('\n📦 Index sizes:');
  const sizes = await sql`
    SELECT 
      indexrelname AS index_name,
      pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
    FROM pg_stat_user_indexes
    WHERE schemaname = 'public' 
      AND indexrelname LIKE 'idx_devices_%'
    ORDER BY pg_relation_size(indexrelid) DESC
  `;
  
  sizes.forEach(size => {
    console.log(`   - ${size.index_name}: ${size.index_size}`);
  });
  
} catch (error) {
  console.error('❌ Error creating GIN indexes:', error);
  throw error;
} finally {
  await sql.end();
}
