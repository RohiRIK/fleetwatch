/**
 * Compliance Repository
 *
 * Manages compliance policies and evaluations in the normalized schema:
 * - Fetches policy versions by policy_id
 * - Creates new policy versions with content hashing
 * - Tracks device-specific evaluation results
 * - Handles bulk operations
 */

import type { Client } from '@opensearch-project/opensearch';
import { createHash } from 'crypto';
import { INDICES } from '../config/opensearch';
import type {
  CompliancePolicy,
  ComplianceSettings,
  CompliancePlatform,
  DeviceCompliancePolicyReference,
  CompliancePolicyStatus,
  CompliancePolicyEvaluation,
  ComplianceSettingState
} from '../schemas/device.schema';

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Calculate SHA256 hash of settings payload for content-based versioning
 * Uses canonical JSON serialization (sorted keys) for consistent hashing
 */
export function calculateComplianceContentHash(settingsPayload: ComplianceSettings): string {
  const canonical = JSON.stringify(settingsPayload, Object.keys(settingsPayload).sort());
  return createHash('sha256').update(canonical).digest('hex');
}

/**
 * Normalize platform string to standard format
 */
export function normalizeCompliancePlatform(platformType: string): CompliancePlatform {
  const lower = platformType.toLowerCase();
  if (lower.includes('windows')) return 'windows';
  if (lower.includes('macos')) return 'macOS';
  if (lower.includes('ios') && !lower.includes('macos')) return 'iOS';
  if (lower.includes('android')) return 'android';
  if (lower.includes('linux')) return 'linux';
  return 'windows'; // Default fallback
}

/**
 * Extract compliance status from Graph API state
 */
export function extractComplianceStatus(state: string): CompliancePolicyStatus {
  const lower = state?.toLowerCase() || '';
  if (lower === 'compliant') return 'compliant';
  if (lower === 'noncompliant') return 'noncompliant';
  if (lower === 'conflict') return 'conflict';
  if (lower === 'error') return 'error';
  if (lower === 'pending') return 'pending';
  if (lower === 'notapplicable') return 'notApplicable';
  return 'unknown';
}

// ============================================================================
// Compliance Repository
// ============================================================================

export class ComplianceRepository {
  constructor(private client: Client) {}

  /**
   * Get the latest version of a compliance policy
   * Returns null if policy doesn't exist
   */
  async getLatestVersion(policyId: string): Promise<{ version: number; content_hash: string } | null> {
    try {
      const response = await this.client.search({
        index: INDICES.COMPLIANCE_POLICIES,
        body: {
          query: {
            term: { policy_id: policyId }
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
   * Get a specific policy version
   */
  async getPolicyVersion(policyId: string, version: number): Promise<CompliancePolicy | null> {
    try {
      const docId = `${policyId}-v${version}`;
      const response = await this.client.get({
        index: INDICES.COMPLIANCE_POLICIES,
        id: docId
      });

      return response.body._source as CompliancePolicy;
    } catch (error: any) {
      if (error.statusCode === 404) return null;
      throw error;
    }
  }

  /**
   * Create or update a compliance policy with content-based versioning
   * Returns the version number (existing or new)
   */
  async upsertPolicy(
    policyId: string,
    displayName: string,
    platform: CompliancePlatform,
    settingsPayload: ComplianceSettings,
    description: string | undefined,
    createdDate: string,
    lastModifiedDate: string
  ): Promise<number> {
    // Calculate content hash
    const contentHash = calculateComplianceContentHash(settingsPayload);

    // Check if latest version has same content
    const latest = await this.getLatestVersion(policyId);

    if (latest && latest.content_hash === contentHash) {
      // Content unchanged - return existing version
      return latest.version;
    }

    // Content changed - create new version
    const newVersion = latest ? latest.version + 1 : 1;
    const docId = `${policyId}-v${newVersion}`;

    const policy: CompliancePolicy = {
      policy_id: policyId,
      version: newVersion,
      content_hash: contentHash,
      display_name: displayName,
      description,
      platform,
      settings_payload: settingsPayload,
      created_date: createdDate,
      last_modified_date: lastModifiedDate,
      is_active_reference: true, // New versions are active by default
      indexed_at: new Date().toISOString()
    };

    await this.client.index({
      index: INDICES.COMPLIANCE_POLICIES,
      id: docId,
      body: policy,
      refresh: 'wait_for' // Wait for refresh so subsequent reads see this document
    });

    return newVersion;
  }

  /**
   * Bulk upsert compliance policies
   * Returns a map of policy_id -> version
   */
  async bulkUpsertPolicies(
    policies: Array<{
      policyId: string;
      displayName: string;
      platform: CompliancePlatform;
      settingsPayload: ComplianceSettings;
      description?: string;
      createdDate: string;
      lastModifiedDate: string;
    }>
  ): Promise<Map<string, number>> {
    const versionMap = new Map<string, number>();

    // Fetch latest versions for all policies in parallel
    const latestVersions = await Promise.all(
      policies.map(p => this.getLatestVersion(p.policyId))
    );

    const bulkBody: any[] = [];
    const indexedAt = new Date().toISOString();

    for (let i = 0; i < policies.length; i++) {
      const policy = policies[i];
      const latest = latestVersions[i];
      const contentHash = calculateComplianceContentHash(policy.settingsPayload);

      let version: number;

      if (latest && latest.content_hash === contentHash) {
        // Content unchanged - use existing version
        version = latest.version;
        versionMap.set(policy.policyId, version);
        continue; // Skip bulk indexing
      }

      // Content changed - create new version
      version = latest ? latest.version + 1 : 1;
      versionMap.set(policy.policyId, version);

      const docId = `${policy.policyId}-v${version}`;

      const doc: CompliancePolicy = {
        policy_id: policy.policyId,
        version,
        content_hash: contentHash,
        display_name: policy.displayName,
        description: policy.description,
        platform: policy.platform,
        settings_payload: policy.settingsPayload,
        created_date: policy.createdDate,
        last_modified_date: policy.lastModifiedDate,
        is_active_reference: true,
        indexed_at: indexedAt
      };

      bulkBody.push({ index: { _index: INDICES.COMPLIANCE_POLICIES, _id: docId } });
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
   * Get the latest evaluation for a device-policy combination
   */
  async getEvaluation(deviceId: string, policyId: string): Promise<CompliancePolicyEvaluation | null> {
    try {
      const response = await this.client.search({
        index: INDICES.COMPLIANCE_EVALUATIONS,
        body: {
          query: {
            bool: {
              must: [
                { term: { device_id: deviceId } },
                { term: { policy_id: policyId } }
              ]
            }
          },
          sort: [{ evaluation_timestamp: { order: 'desc' } }],
          size: 1
        }
      });

      const hits = response.body.hits.hits;
      if (hits.length === 0) return null;

      return hits[0]._source as CompliancePolicyEvaluation;
    } catch (error: any) {
      if (error.statusCode === 404) return null;
      throw error;
    }
  }

  /**
   * Upsert a compliance evaluation for a device-policy combination
   */
  async upsertEvaluation(
    deviceId: string,
    policyId: string,
    policyVersion: number,
    evaluationTimestamp: string,
    deploymentStatus: CompliancePolicyStatus,
    settingStates: ComplianceSettingState[],
    errorCodes: string[]
  ): Promise<void> {
    // Document ID format: {device_id}-{policy_id} (latest always overwrites)
    const docId = `${deviceId}-${policyId}`;

    const evaluation: CompliancePolicyEvaluation = {
      device_id: deviceId,
      policy_id: policyId,
      policy_version: policyVersion,
      evaluation_timestamp: evaluationTimestamp,
      deployment_status: deploymentStatus,
      setting_states: settingStates,
      error_codes: errorCodes,
      indexed_at: new Date().toISOString()
    };

    await this.client.index({
      index: INDICES.COMPLIANCE_EVALUATIONS,
      id: docId,
      body: evaluation,
      refresh: false // Don't wait for refresh (performance)
    });
  }

  /**
   * Bulk upsert compliance evaluations
   */
  async bulkUpsertEvaluations(
    evaluations: Array<{
      deviceId: string;
      policyId: string;
      policyVersion: number;
      evaluationTimestamp: string;
      deploymentStatus: CompliancePolicyStatus;
      settingStates: ComplianceSettingState[];
      errorCodes: string[];
    }>
  ): Promise<void> {
    if (evaluations.length === 0) return;

    const bulkBody: any[] = [];
    const indexedAt = new Date().toISOString();

    for (const evaluationItem of evaluations) {
      const docId = `${evaluationItem.deviceId}-${evaluationItem.policyId}`;

      const doc: CompliancePolicyEvaluation = {
        device_id: evaluationItem.deviceId,
        policy_id: evaluationItem.policyId,
        policy_version: evaluationItem.policyVersion,
        evaluation_timestamp: evaluationItem.evaluationTimestamp,
        deployment_status: evaluationItem.deploymentStatus,
        setting_states: evaluationItem.settingStates,
        error_codes: evaluationItem.errorCodes,
        indexed_at: indexedAt
      };

      bulkBody.push({ index: { _index: INDICES.COMPLIANCE_EVALUATIONS, _id: docId } });
      bulkBody.push(doc);
    }

    const response = await this.client.bulk({
      body: bulkBody,
      refresh: false
    });

    if (response.body.errors) {
      const errors = response.body.items.filter((item: any) => item.index?.error);
      console.error(`Bulk evaluation upsert had ${errors.length} errors:`, errors.slice(0, 5));
      throw new Error('Bulk evaluation upsert failed with errors');
    }
  }

  /**
   * Get bulk policies by policy_id (latest versions only)
   * Returns a map of policy_id -> CompliancePolicy
   */
  async getBulkPolicies(policyIds: string[]): Promise<Map<string, CompliancePolicy>> {
    const policies = new Map<string, CompliancePolicy>();

    if (policyIds.length === 0) return policies;

    // Use multi-search to get latest version of each policy
    const searches = policyIds.map(policyId => [
      { index: INDICES.COMPLIANCE_POLICIES },
      {
        query: { term: { policy_id: policyId } },
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
        const policy = resp.hits.hits[0]._source as CompliancePolicy;
        policies.set(policy.policy_id, policy);
      }
    }

    return policies;
  }
}

// ============================================================================
// Helper Functions for Device Normalizer
// ============================================================================

/**
 * Convert device compliance state to lightweight reference
 * This is used in dual-write mode
 */
export function createComplianceReference(
  policyId: string,
  displayName: string,
  version: number,
  state: string,
  errorCount: number,
  totalSettings: number,
  resultCode?: string,
  lastEvaluated?: string
): DeviceCompliancePolicyReference {
  return {
    policy_id: policyId,
    display_name_cached: displayName,
    version: version,
    deployment_status: extractComplianceStatus(state),
    error_count: errorCount,
    total_settings: totalSettings,
    result_code: resultCode,
    last_evaluated: lastEvaluated || new Date().toISOString()
  };
}
