import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });

console.log('🚀 Phase 2 Performance Benchmark\n');
console.log('Testing query performance with new indexes...\n');

// Benchmark 1: Compliance filter
console.log('📊 Test 1: Compliance filter (idx_devices_is_compliant)');
const result1 = await sql`
  EXPLAIN ANALYZE 
  SELECT * FROM devices WHERE is_compliant = false
`;
console.log(result1.map(r => r['QUERY PLAN']).join('\n'));

// Benchmark 2: Operating system filter
console.log('\n\n📊 Test 2: Operating system filter (idx_devices_operating_system)');
const result2 = await sql`
  EXPLAIN ANALYZE 
  SELECT * FROM devices WHERE operating_system = 'Windows'
`;
console.log(result2.map(r => r['QUERY PLAN']).join('\n'));

// Benchmark 3: Combined filters
console.log('\n\n📊 Test 3: Combined filters (multiple indexes)');
const result3 = await sql`
  EXPLAIN ANALYZE 
  SELECT * FROM devices 
  WHERE is_compliant = false AND operating_system = 'Windows'
`;
console.log(result3.map(r => r['QUERY PLAN']).join('\n'));

// Benchmark 4: User join
console.log('\n\n📊 Test 4: User-device join (idx_devices_user_id)');
const result4 = await sql`
  EXPLAIN ANALYZE 
  SELECT d.device_name, u.email, u.given_name, u.surname
  FROM devices d
  LEFT JOIN users u ON d.user_id = u.id
  LIMIT 10
`;
console.log(result4.map(r => r['QUERY PLAN']).join('\n'));

// Benchmark 5: JSONB query (GIN index)
console.log('\n\n📊 Test 5: JSONB security query (idx_devices_security_details GIN)');
const result5 = await sql`
  EXPLAIN ANALYZE 
  SELECT device_name, security_details
  FROM devices 
  WHERE security_details IS NOT NULL
`;
console.log(result5.map(r => r['QUERY PLAN']).join('\n'));

console.log('\n\n✅ Performance benchmark complete!\n');
console.log('Expected results:');
console.log('- Should see "Index Scan" or "Bitmap Index Scan" for indexed queries');
console.log('- Execution times should be < 10ms for small datasets');
console.log('- No "Seq Scan" on filtered queries (good!)');
console.log('- "Seq Scan" is OK for full table queries without WHERE clause\n');

// Get index usage statistics
console.log('📊 Index usage statistics:\n');
const indexStats = await sql`
  SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan as scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched
  FROM pg_stat_user_indexes
  WHERE tablename = 'devices' 
    AND indexname LIKE 'idx_devices_%'
  ORDER BY idx_scan DESC
`;

console.log('Index scans performed:');
indexStats.forEach(stat => {
  console.log(`   - ${stat.indexname}: ${stat.scans} scans, ${stat.tuples_fetched} tuples fetched`);
});

await sql.end();
