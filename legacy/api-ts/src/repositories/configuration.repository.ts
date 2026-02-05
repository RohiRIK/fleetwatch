/**
 * Configuration Repository
 *
 * Manages configuration profiles in the normalized schema:
 * - Fetches profile versions by config_id
 * - Creates new profile versions with content hashing
 * - Tracks active references
 * - Handles bulk operations
 */

import type { Client } from '@opensearch-project/opensearch';
import { createHash } from 'crypto';
import { INDICES } from '../config/opensearch';
import type {
  ConfigurationProfile,
  ConfigurationSettings,
  ConfigPlatform,
  DeviceConfigurationReference,
  ConfigDeploymentStatus
} from '../schemas/device.schema';

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Calculate SHA256 hash of settings payload for content-based versioning
 * Uses canonical JSON serialization (sorted keys) for consistent hashing
 */
export function calculateContentHash(settingsPayload: ConfigurationSettings): string {
  const canonical = JSON.stringify(settingsPayload, Object.keys(settingsPayload).sort());
  return createHash('sha256').update(canonical).digest('hex');
}

/**
 * Normalize platform string to standard format
 */
export function normalizePlatform(platformType: string): ConfigPlatform {
  const lower = platformType.toLowerCase();
  if (lower.includes('windows')) return 'windows';
  if (lower.includes('macos')) return 'macOS';
  if (lower.includes('ios') && !lower.includes('macos')) return 'iOS';
  if (lower.includes('android')) return 'android';
  if (lower.includes('linux')) return 'linux';
  return 'windows'; // Default fallback
}

/**
 * Extract deployment status from Graph API state
 */
export function extractDeploymentStatus(state: string): ConfigDeploymentStatus {
  const lower = state?.toLowerCase() || '';
  if (lower === 'success' || lower === 'compliant') return 'success';
  if (lower === 'conflict') return 'conflict';
  if (lower === 'error' || lower === 'noncompliant') return 'error';
  if (lower === 'pending' || lower === 'notapplicable') return 'notApplicable';
  return 'unknown';
}

// ============================================================================
// Configuration Repository
// ============================================================================

export class ConfigurationRepository {
  constructor(private client: Client) {}

  /**
   * Get the latest version of a configuration profile
   * Returns null if profile doesn't exist
   */
  async getLatestVersion(configId: string): Promise<{ version: number; content_hash: string } | null> {
    try {
      const response = await this.client.search({
        index: INDICES.CONFIGURATION_PROFILES,
        body: {
          query: {
            term: { config_id: configId }
          },
          sort: [{ version: { order: 'desc' } }],
          size: 1,
          _source: ['version', 'content_hash']
        }
      });

      const hits = response.body.hits.hits;
      if (hits.length === 0) return null;

      const doc = hits[0]._source;
      return {
        version: doc.version,
        content_hash: doc.content_hash
      };
    } catch (error: any) {
      if (error.statusCode === 404) return null;
      throw error;
    }
  }

  /**
   * Get a specific profile version
   */
  async getProfileVersion(configId: string, version: number): Promise<ConfigurationProfile | null> {
    try {
      const docId = `${configId}-v${version}`;
      const response = await this.client.get({
        index: INDICES.CONFIGURATION_PROFILES,
        id: docId
      });

      return response.body._source as ConfigurationProfile;
    } catch (error: any) {
      if (error.statusCode === 404) return null;
      throw error;
    }
  }

  /**
   * Create or update a configuration profile with content-based versioning
   * Returns the version number (existing or new)
   */
  async upsertProfile(
    configId: string,
    displayName: string,
    platform: ConfigPlatform,
    settingsPayload: ConfigurationSettings,
    createdDate: string,
    lastModifiedDate: string
  ): Promise<number> {
    // Calculate content hash
    const contentHash = calculateContentHash(settingsPayload);

    // Check if latest version has same content
    const latest = await this.getLatestVersion(configId);

    if (latest && latest.content_hash === contentHash) {
      // Content unchanged - return existing version
      return latest.version;
    }

    // Content changed - create new version
    const newVersion = latest ? latest.version + 1 : 1;
    const docId = `${configId}-v${newVersion}`;

    const profile: ConfigurationProfile = {
      config_id: configId,
      version: newVersion,
      content_hash: contentHash,
      display_name: displayName,
      platform,
      settings_payload: settingsPayload,
      created_date: createdDate,
      last_modified_date: lastModifiedDate,
      is_active_reference: true, // New versions are active by default
      indexed_at: new Date().toISOString()
    };

    await this.client.index({
      index: INDICES.CONFIGURATION_PROFILES,
      id: docId,
      body: profile,
      refresh: 'wait_for' // Wait for refresh so subsequent reads see this document
    });

    return newVersion;
  }

  /**
   * Bulk upsert configuration profiles
   * Returns a map of config_id -> version
   */
  async bulkUpsertProfiles(
    profiles: Array<{
      configId: string;
      displayName: string;
      platform: ConfigPlatform;
      settingsPayload: ConfigurationSettings;
      createdDate: string;
      lastModifiedDate: string;
    }>
  ): Promise<Map<string, number>> {
    const versionMap = new Map<string, number>();

    // Fetch latest versions for all profiles in parallel
    const latestVersions = await Promise.all(
      profiles.map(p => this.getLatestVersion(p.configId))
    );

    const bulkBody: any[] = [];
    const indexedAt = new Date().toISOString();

    for (let i = 0; i < profiles.length; i++) {
      const profile = profiles[i];
      const latest = latestVersions[i];
      const contentHash = calculateContentHash(profile.settingsPayload);

      let version: number;

      if (latest && latest.content_hash === contentHash) {
        // Content unchanged - use existing version
        version = latest.version;
        versionMap.set(profile.configId, version);
        continue; // Skip bulk indexing
      }

      // Content changed - create new version
      version = latest ? latest.version + 1 : 1;
      versionMap.set(profile.configId, version);

      const docId = `${profile.configId}-v${version}`;

      const doc: ConfigurationProfile = {
        config_id: profile.configId,
        version,
        content_hash: contentHash,
        display_name: profile.displayName,
        platform: profile.platform,
        settings_payload: profile.settingsPayload,
        created_date: profile.createdDate,
        last_modified_date: profile.lastModifiedDate,
        is_active_reference: true,
        indexed_at: indexedAt
      };

      bulkBody.push({ index: { _index: INDICES.CONFIGURATION_PROFILES, _id: docId } });
      bulkBody.push(doc);
    }

    // Execute bulk operation if there are new versions
    if (bulkBody.length > 0) {
      const response = await this.client.bulk({
        body: bulkBody,
        refresh: false // Don't refresh immediately for performance
      });

      if (response.body.errors) {
        const errors = response.body.items.filter((item: any) => item.index?.error);
        console.error(`Bulk upsert had ${errors.length} errors:`, errors.slice(0, 5));
        throw new Error('Bulk upsert failed with errors');
      }
    }

    return versionMap;
  }

  /**
   * Mark profile versions as active or inactive based on device references
   * This is used by the cleanup job
   */
  async updateActiveReferences(activeConfigIds: Set<string>): Promise<void> {
    // This would be called by a nightly cleanup job
    // For now, we'll keep all versions active
    // TODO: Implement cleanup job in Phase 3
  }

  /**
   * Get bulk profiles by config_id (latest versions only)
   * Returns a map of config_id -> ConfigurationProfile
   */
  async getBulkProfiles(configIds: string[]): Promise<Map<string, ConfigurationProfile>> {
    const profiles = new Map<string, ConfigurationProfile>();

    if (configIds.length === 0) return profiles;

    // Use multi-search to get latest version of each profile
    const searches = configIds.map(configId => [
      { index: INDICES.CONFIGURATION_PROFILES },
      {
        query: { term: { config_id: configId } },
        sort: [{ version: { order: 'desc' } }],
        size: 1
      }
    ]).flat();

    const response = await this.client.msearch({
      body: searches
    });

    const responses = response.body.responses;
    for (let i = 0; i < responses.length; i++) {
      const resp = responses[i];
      if (resp.hits && resp.hits.hits.length > 0) {
        const profile = resp.hits.hits[0]._source as ConfigurationProfile;
        profiles.set(profile.config_id, profile);
      }
    }

    return profiles;
  }
}

// ============================================================================
// Helper Functions for Device Normalizer
// ============================================================================

/**
 * Convert device configuration state to lightweight reference
 * This is used in dual-write mode
 */
export function createConfigurationReference(
  configId: string,
  displayName: string,
  version: number,
  state: string,
  resultCode?: string,
  lastEvaluated?: string
): DeviceConfigurationReference {
  return {
    config_id: configId,
    display_name_cached: displayName,
    version: version,
    deployment_status: extractDeploymentStatus(state),
    result_code: resultCode,
    last_evaluated: lastEvaluated || new Date().toISOString()
  };
}
