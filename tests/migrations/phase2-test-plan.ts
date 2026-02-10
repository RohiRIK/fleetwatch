/**
 * ============================================================================
 * PHASE 2 DATABASE MIGRATION - TEST PLAN
 * ============================================================================
 * 
 * This test plan validates the Phase 2 schema changes and index additions.
 * Tests ensure backward compatibility, performance improvements, and data integrity.
 * 
 * Test Environment: Local PostgreSQL or Neon development database
 * Prerequisites: 
 * - Apply migrations 0006 (columns), 0007 (B-tree indexes), 0008 (GIN indexes)
 * - Run full device and user sync
 * ============================================================================
 */

// ============================================================================
// TEST 1: Schema Validation - New Columns Exist
// ============================================================================
/**
 * Verify all 9 new columns exist in the schema
 */
export async function testSchemaColumns() {
  const results = {
    passed: 0,
    failed: 0,
    tests: [] as Array<{ name: string; status: string; message?: string }>,
  };

  // SQL query to check column existence
  const checkColumns = `
    SELECT 
      column_name,
      data_type,
      is_nullable
    FROM information_schema.columns
    WHERE table_name = 'devices' 
      AND column_name IN (
        'compliance_grace_period_expiration',
        'partner_reported_threat_state',
        'notes',
        'imei',
        'phone_number'
      )
    ORDER BY column_name;
  `;

  const checkUserColumns = `
    SELECT 
      column_name,
      data_type,
      is_nullable
    FROM information_schema.columns
    WHERE table_name = 'users' 
      AND column_name IN (
        'given_name',
        'surname',
        'mobile_phone',
        'office_location'
      )
    ORDER BY column_name;
  `;

  console.log('TEST 1: Verifying new device columns exist...');
  console.log(checkColumns);
  console.log('\nTEST 1b: Verifying new user columns exist...');
  console.log(checkUserColumns);

  // Expected results:
  // 5 device columns, all nullable
  // 4 user columns, all nullable
  
  return results;
}

// ============================================================================
// TEST 2: Index Validation - B-tree Indexes Created
// ============================================================================
/**
 * Verify all 6 B-tree indexes were created successfully
 */
export async function testBtreeIndexes() {
  const checkIndexes = `
    SELECT 
      indexname,
      tablename,
      indexdef
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
    ORDER BY indexname;
  `;

  console.log('TEST 2: Verifying B-tree indexes...');
  console.log(checkIndexes);
  
  // Expected: 6 indexes returned
  // All should use btree method
  
  return {
    expectedCount: 6,
    query: checkIndexes,
  };
}

// ============================================================================
// TEST 3: Index Validation - GIN Indexes Created
// ============================================================================
/**
 * Verify all 3 GIN indexes on JSONB columns were created successfully
 */
export async function testGinIndexes() {
  const checkIndexes = `
    SELECT 
      indexname,
      tablename,
      indexdef
    FROM pg_indexes
    WHERE tablename = 'devices'
      AND indexname IN (
        'idx_devices_security_details',
        'idx_devices_detected_apps',
        'idx_devices_compliance_details'
      )
    ORDER BY indexname;
  `;

  console.log('TEST 3: Verifying GIN indexes on JSONB columns...');
  console.log(checkIndexes);
  
  // Expected: 3 indexes returned
  // All should use GIN method
  // All should target JSONB columns
  
  return {
    expectedCount: 3,
    query: checkIndexes,
  };
}

// ============================================================================
// TEST 4: Backward Compatibility - No Breaking Changes
// ============================================================================
/**
 * Verify existing queries still work (no breaking changes)
 */
export async function testBackwardCompatibility() {
  const testQueries = [
    {
      name: 'Device list query',
      query: `SELECT id, device_name, is_compliant, operating_system FROM devices LIMIT 10;`,
      expectedBehavior: 'Should return 10 devices with all columns',
    },
    {
      name: 'User list query',
      query: `SELECT id, email, name, department FROM users LIMIT 10;`,
      expectedBehavior: 'Should return 10 users with all columns',
    },
    {
      name: 'Device-user join',
      query: `
        SELECT d.device_name, u.email 
        FROM devices d 
        LEFT JOIN users u ON d.user_id = u.id 
        LIMIT 10;
      `,
      expectedBehavior: 'Should join devices with users successfully',
    },
  ];

  console.log('TEST 4: Backward compatibility tests...');
  testQueries.forEach((test) => {
    console.log(`\n${test.name}:`);
    console.log(test.query);
    console.log(`Expected: ${test.expectedBehavior}`);
  });

  return testQueries;
}

// ============================================================================
// TEST 5: Data Sync - New Columns Populated
// ============================================================================
/**
 * Verify sync services correctly populate new columns
 */
export async function testDataPopulation() {
  const deviceDataCheck = `
    SELECT 
      device_name,
      compliance_grace_period_expiration,
      partner_reported_threat_state,
      imei,
      phone_number,
      notes
    FROM devices
    WHERE operating_system IN ('iOS', 'Android')
    LIMIT 10;
  `;

  const userDataCheck = `
    SELECT 
      email,
      given_name,
      surname,
      mobile_phone,
      office_location
    FROM users
    LIMIT 10;
  `;

  console.log('TEST 5a: Check device columns populated by sync...');
  console.log(deviceDataCheck);
  console.log('\nExpected: Mobile devices should have IMEI populated');
  console.log('Expected: compliance_grace_period_expiration may be null or populated');
  console.log('Expected: notes should be null (admin-only field)');

  console.log('\n\nTEST 5b: Check user columns populated by sync...');
  console.log(userDataCheck);
  console.log('\nExpected: givenName and surname should be populated from Azure AD');
  console.log('Expected: mobilePhone and officeLocation may be null if not in Azure AD');

  return {
    deviceQuery: deviceDataCheck,
    userQuery: userDataCheck,
  };
}

// ============================================================================
// TEST 6: Performance - Index Usage Verification
// ============================================================================
/**
 * Verify indexes are used by query planner
 */
export async function testIndexUsage() {
  const queryTests = [
    {
      name: 'Compliance filter uses index',
      query: `EXPLAIN ANALYZE SELECT * FROM devices WHERE is_compliant = false;`,
      expectedPlan: 'Should use idx_devices_is_compliant (Index Scan)',
    },
    {
      name: 'OS filter uses index',
      query: `EXPLAIN ANALYZE SELECT * FROM devices WHERE operating_system = 'Windows';`,
      expectedPlan: 'Should use idx_devices_operating_system (Index Scan)',
    },
    {
      name: 'Security JSONB query uses GIN index',
      query: `EXPLAIN ANALYZE SELECT * FROM devices WHERE security_details @> '{"bitLockerEnabled": true}';`,
      expectedPlan: 'Should use idx_devices_security_details (Bitmap Index Scan)',
    },
    {
      name: 'Combined filters use indexes',
      query: `EXPLAIN ANALYZE SELECT * FROM devices WHERE is_compliant = false AND operating_system = 'Windows';`,
      expectedPlan: 'Should use one or both indexes',
    },
  ];

  console.log('TEST 6: Performance - Index usage verification...\n');
  queryTests.forEach((test) => {
    console.log(`\n${test.name}:`);
    console.log(test.query);
    console.log(`Expected: ${test.expectedPlan}\n`);
    console.log('To verify: Look for "Index Scan" or "Bitmap Index Scan" in EXPLAIN output');
    console.log('Red flag: "Seq Scan" means index is NOT being used\n');
    console.log('---');
  });

  return queryTests;
}

// ============================================================================
// TEST 7: Performance Benchmarks - Before/After Comparison
// ============================================================================
/**
 * Compare query performance before and after indexes
 */
export async function testPerformanceImprovement() {
  const benchmarks = [
    {
      name: 'Device list with compliance filter',
      query: `SELECT * FROM devices WHERE is_compliant = false;`,
      expectedBefore: '~200-500ms (Seq Scan)',
      expectedAfter: '~10-30ms (Index Scan)',
      expectedImprovement: '10-50x faster',
    },
    {
      name: 'Security query (BitLocker status)',
      query: `SELECT device_name, security_details->>'bitLockerEnabled' FROM devices WHERE security_details @> '{"bitLockerEnabled": true}';`,
      expectedBefore: '~1500ms (Seq Scan + JSONB parsing)',
      expectedAfter: '~50-150ms (GIN Index Scan)',
      expectedImprovement: '10-30x faster',
    },
    {
      name: 'App search query',
      query: `SELECT device_name FROM devices WHERE detected_apps_details @> '[{"displayName": "Microsoft Office"}]';`,
      expectedBefore: '~2000ms (Seq Scan + JSONB parsing)',
      expectedAfter: '~20-100ms (GIN Index Scan)',
      expectedImprovement: '20-100x faster',
    },
  ];

  console.log('TEST 7: Performance improvement benchmarks...\n');
  console.log('To run these benchmarks:');
  console.log('1. First, drop all indexes and measure query time');
  console.log('2. Re-create indexes');
  console.log('3. Clear query cache: SELECT pg_stat_reset();');
  console.log('4. Run queries again and measure improvement\n');

  benchmarks.forEach((bench, idx) => {
    console.log(`\n${idx + 1}. ${bench.name}`);
    console.log(`Query: ${bench.query}`);
    console.log(`Expected before: ${bench.expectedBefore}`);
    console.log(`Expected after: ${bench.expectedAfter}`);
    console.log(`Expected improvement: ${bench.expectedImprovement}`);
    console.log('---');
  });

  return benchmarks;
}

// ============================================================================
// TEST 8: Data Integrity - Null Handling
// ============================================================================
/**
 * Verify new columns handle null values correctly
 */
export async function testNullHandling() {
  const nullTests = [
    {
      name: 'All new columns should be nullable',
      query: `
        SELECT 
          COUNT(*) as total_devices,
          COUNT(compliance_grace_period_expiration) as has_grace_period,
          COUNT(partner_reported_threat_state) as has_threat_state,
          COUNT(imei) as has_imei,
          COUNT(phone_number) as has_phone,
          COUNT(notes) as has_notes
        FROM devices;
      `,
      expectedBehavior: 'has_notes should be 0 (admin-only), others may be 0-100%',
    },
    {
      name: 'User columns should handle nulls',
      query: `
        SELECT 
          COUNT(*) as total_users,
          COUNT(given_name) as has_given_name,
          COUNT(surname) as has_surname,
          COUNT(mobile_phone) as has_mobile,
          COUNT(office_location) as has_office
        FROM users;
      `,
      expectedBehavior: 'Most users should have givenName/surname, others optional',
    },
  ];

  console.log('TEST 8: Data integrity - null handling...\n');
  nullTests.forEach((test) => {
    console.log(`\n${test.name}:`);
    console.log(test.query);
    console.log(`Expected: ${test.expectedBehavior}\n`);
  });

  return nullTests;
}

// ============================================================================
// TEST 9: Index Size - Storage Impact
// ============================================================================
/**
 * Measure index sizes to verify storage estimates
 */
export async function testIndexSizes() {
  const sizeQuery = `
    SELECT 
      indexrelname AS index_name,
      pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
      pg_relation_size(indexrelid) AS size_bytes
    FROM pg_stat_user_indexes
    WHERE schemaname = 'public'
      AND indexrelname LIKE 'idx_devices_%'
    ORDER BY pg_relation_size(indexrelid) DESC;
  `;

  console.log('TEST 9: Index storage impact...\n');
  console.log(sizeQuery);
  console.log('\nExpected total index size: 15-30 MB (for 10K devices)');
  console.log('Breakdown:');
  console.log('- B-tree indexes: ~6-12 MB (6 indexes × 1-2 MB each)');
  console.log('- GIN indexes: ~9-18 MB (3 indexes × 3-6 MB each)');
  console.log('\nThis is ~1-2% database storage increase for 10-200x query speedup');

  return sizeQuery;
}

// ============================================================================
// TEST 10: Rollback Test - Verify Safe Removal
// ============================================================================
/**
 * Verify indexes can be safely removed if needed
 */
export async function testRollbackProcedure() {
  console.log('TEST 10: Rollback procedure verification...\n');
  console.log('To test rollback safety:');
  console.log('1. Drop ONE index at a time with CONCURRENTLY flag');
  console.log('2. Verify queries still work (just slower)');
  console.log('3. Re-create index if needed\n');

  const rollbackSteps = [
    'Step 1: Drop a single index',
    'DROP INDEX CONCURRENTLY IF EXISTS idx_devices_is_compliant;',
    '',
    'Step 2: Verify queries still work',
    'SELECT * FROM devices WHERE is_compliant = false LIMIT 10;',
    '(Should work, just slower - uses Seq Scan instead of Index Scan)',
    '',
    'Step 3: Re-create if needed',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_devices_is_compliant ON devices (is_compliant);',
    '',
    'CRITICAL: Never drop columns in production - data loss is irreversible!',
    'Indexes can be dropped/recreated safely anytime.',
  ];

  rollbackSteps.forEach((step) => console.log(step));

  return rollbackSteps;
}

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================
export async function runAllTests() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║  PHASE 2 DATABASE MIGRATION - COMPREHENSIVE TEST SUITE        ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  const tests = [
    { name: 'Schema Validation', fn: testSchemaColumns },
    { name: 'B-tree Indexes', fn: testBtreeIndexes },
    { name: 'GIN Indexes', fn: testGinIndexes },
    { name: 'Backward Compatibility', fn: testBackwardCompatibility },
    { name: 'Data Population', fn: testDataPopulation },
    { name: 'Index Usage', fn: testIndexUsage },
    { name: 'Performance Benchmarks', fn: testPerformanceImprovement },
    { name: 'Null Handling', fn: testNullHandling },
    { name: 'Index Sizes', fn: testIndexSizes },
    { name: 'Rollback Safety', fn: testRollbackProcedure },
  ];

  for (const test of tests) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`TEST: ${test.name}`);
    console.log('='.repeat(70));
    await test.fn();
  }

  console.log('\n\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║  TEST SUITE COMPLETE                                          ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('\nTo run these tests against your database:');
  console.log('1. Apply all migrations (0006, 0007, 0008)');
  console.log('2. Run full device and user sync');
  console.log('3. Execute SQL queries above in your database client');
  console.log('4. Compare actual results to expected results\n');
}

// Export test plan for execution
if (require.main === module) {
  runAllTests().catch(console.error);
}
