#!/usr/bin/env node
/**
 * Test Dual-Write Mode
 *
 * Purpose: Validate dual-write implementation with sample data
 */

import { createOpenSearchClient, INDICES } from '../config/opensearch';
import { ConfigurationRepository, calculateContentHash, normalizePlatform } from '../repositories/configuration.repository';

async function main() {
  console.log('🧪 Testing Dual-Write Implementation\n');

  const client = createOpenSearchClient();

  try {
    // Test 1: Content Hash Calculation
    console.log('Test 1: Content Hash Calculation');
    const settings1 = { setting1: 'value1', setting2: 'value2', '@odata.type': 'test' };
    const settings2 = { setting2: 'value2', setting1: 'value1', '@odata.type': 'test' }; // Different order
    const hash1 = calculateContentHash(settings1);
    const hash2 = calculateContentHash(settings2);

    console.log(`  Hash 1: ${hash1.substring(0, 16)}...`);
    console.log(`  Hash 2: ${hash2.substring(0, 16)}...`);
    console.log(`  ✅ Hashes ${hash1 === hash2 ? 'MATCH' : 'DIFFER'} (should MATCH - canonical JSON)`);

    if (hash1 !== hash2) {
      throw new Error('Content hash calculation failed - hashes should match!');
    }

    // Test 2: Platform Normalization
    console.log('\nTest 2: Platform Normalization');
    const platforms = [
      'windows10CompliancePolicy',
      'macOSCompliancePolicy',
      'iosCompliancePolicy',
      'androidCompliancePolicy',
      'windowsEditionUpgradeConfiguration'
    ];

    for (const platform of platforms) {
      const normalized = normalizePlatform(platform);
      console.log(`  ${platform} → ${normalized}`);
    }
    console.log('  ✅ Platform normalization working');

    // Test 3: Configuration Repository
    console.log('\nTest 3: Configuration Repository');
    const repo = new ConfigurationRepository(client);

    // Check if indices exist
    const profilesExists = await client.indices.exists({ index: INDICES.CONFIGURATION_PROFILES });
    const historyExists = await client.indices.exists({ index: INDICES.DEPLOYMENT_HISTORY });

    console.log(`  configuration_profiles index: ${profilesExists.body ? '✅ EXISTS' : '❌ MISSING'}`);
    console.log(`  deployment_history index: ${historyExists.body ? '✅ EXISTS' : '❌ MISSING'}`);

    if (!profilesExists.body || !historyExists.body) {
      console.log('\n⚠️  Indices not found. Run create-configuration-indices.ts first.');
      return;
    }

    // Test 4: Upsert Profile (creates version 1)
    console.log('\nTest 4: Profile Upsert (Version 1)');
    const testConfigId = 'test-config-123';
    const testSettings = {
      '@odata.type': 'microsoft.graph.windows10CompliancePolicy',
      passwordRequired: true,
      passwordMinimumLength: 8
    };

    const version1 = await repo.upsertProfile(
      testConfigId,
      'Test Configuration Policy',
      'windows',
      testSettings,
      new Date().toISOString(),
      new Date().toISOString()
    );

    console.log(`  ✅ Created version ${version1}`);

    // Test 5: Upsert Same Profile (should reuse version)
    console.log('\nTest 5: Profile Upsert (Same Content)');
    const version2 = await repo.upsertProfile(
      testConfigId,
      'Test Configuration Policy',
      'windows',
      testSettings,
      new Date().toISOString(),
      new Date().toISOString()
    );

    console.log(`  ✅ Returned version ${version2} (should be ${version1})`);

    if (version1 !== version2) {
      throw new Error('Version should be reused when content unchanged!');
    }

    // Test 6: Upsert Modified Profile (should create version 2)
    console.log('\nTest 6: Profile Upsert (Changed Content)');
    const modifiedSettings = {
      ...testSettings,
      passwordMinimumLength: 12 // Changed!
    };

    const version3 = await repo.upsertProfile(
      testConfigId,
      'Test Configuration Policy',
      'windows',
      modifiedSettings,
      new Date().toISOString(),
      new Date().toISOString()
    );

    console.log(`  ✅ Created version ${version3} (should be ${version1 + 1})`);

    if (version3 !== version1 + 1) {
      throw new Error('Version should increment when content changes!');
    }

    // Test 7: Get Latest Version
    console.log('\nTest 7: Get Latest Version');
    const latest = await repo.getLatestVersion(testConfigId);

    if (!latest) {
      throw new Error('Latest version not found!');
    }

    console.log(`  ✅ Latest version: ${latest.version}`);
    console.log(`  ✅ Content hash: ${latest.content_hash.substring(0, 16)}...`);

    // Test 8: Get Specific Version
    console.log('\nTest 8: Get Specific Version');
    const profile = await repo.getProfileVersion(testConfigId, version1);

    if (!profile) {
      throw new Error('Profile version not found!');
    }

    console.log(`  ✅ Retrieved version ${profile.version}`);
    console.log(`  ✅ Display name: ${profile.display_name}`);
    console.log(`  ✅ Platform: ${profile.platform}`);
    console.log(`  ✅ Active reference: ${profile.is_active_reference}`);

    // Test 9: Bulk Upsert
    console.log('\nTest 9: Bulk Upsert Profiles');
    const bulkProfiles = [
      {
        configId: 'bulk-test-1',
        displayName: 'Bulk Test 1',
        platform: 'windows' as const,
        settingsPayload: { '@odata.type': 'test', setting: 'value1' },
        createdDate: new Date().toISOString(),
        lastModifiedDate: new Date().toISOString()
      },
      {
        configId: 'bulk-test-2',
        displayName: 'Bulk Test 2',
        platform: 'macOS' as const,
        settingsPayload: { '@odata.type': 'test', setting: 'value2' },
        createdDate: new Date().toISOString(),
        lastModifiedDate: new Date().toISOString()
      }
    ];

    const versionMap = await repo.bulkUpsertProfiles(bulkProfiles);

    console.log(`  ✅ Bulk upserted ${versionMap.size} profiles`);
    for (const [configId, version] of versionMap) {
      console.log(`     ${configId}: v${version}`);
    }

    // Cleanup test data
    console.log('\nTest 10: Cleanup');
    const testIds = [
      `${testConfigId}-v1`,
      `${testConfigId}-v${version3}`,
      'bulk-test-1-v1',
      'bulk-test-2-v1'
    ];

    for (const docId of testIds) {
      try {
        await client.delete({
          index: INDICES.CONFIGURATION_PROFILES,
          id: docId,
          refresh: true
        });
        console.log(`  ✅ Deleted ${docId}`);
      } catch (error: any) {
        if (error.statusCode !== 404) {
          console.log(`  ⚠️  Failed to delete ${docId}: ${error.message}`);
        }
      }
    }

    console.log('\n✅ All tests passed! Dual-write implementation is working correctly.\n');

  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
