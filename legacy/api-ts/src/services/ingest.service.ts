// Ingest Service - Handles bulk indexing to OpenSearch with batch processing
import type { Client } from '@opensearch-project/opensearch';
import type { UnifiedDeviceDocument } from '../schemas/device.schema';
import type { UnifiedUserDocument } from '../schemas/user.schema';
import type { UnifiedLicenseDocument } from '../schemas/license.schema';
import type { ConditionalAccessPolicy } from '../schemas/conditional-access.schema';
import type { ExperienceMetric, ExperienceEvent } from '../schemas/analytics.schema';
import { INDICES, BULK_CONFIG, refreshIndex } from '../config/opensearch';

export interface IngestResult {
  success: boolean;
  indexed: number;
  failed: number;
  errors?: Array<{
    id: string;
    error: string;
  }>;
  duration: number;
}

export interface IngestStats {
  totalDocuments: number;
  successfulIndexes: number;
  failedIndexes: number;
  batchesProcessed: number;
  startTime: Date;
  endTime?: Date;
  durationMs?: number;
}

/**
 * Ingest Service for bulk indexing operations
 */
export class IngestService {
  constructor(private client: Client) {}

  /**
   * Bulk index devices into OpenSearch
   * Uses upsert (index operation) - will update existing documents or create new ones
   */
  async ingestDevices(
    devices: UnifiedDeviceDocument[],
    options: {
      refresh?: boolean;
      batchSize?: number;
      continueOnError?: boolean;
      mode?: 'upsert' | 'replace'; // upsert = incremental, replace = full reindex
    } = {}
  ): Promise<IngestResult> {
    const startTime = Date.now();
    const {
      refresh = false,
      batchSize = BULK_CONFIG.BATCH_SIZE,
      continueOnError = true
    } = options;

    console.log(`Starting device ingest: ${devices.length} documents`);

    const stats: IngestStats = {
      totalDocuments: devices.length,
      successfulIndexes: 0,
      failedIndexes: 0,
      batchesProcessed: 0,
      startTime: new Date()
    };

    const errors: Array<{ id: string; error: string }> = [];

    // Process in batches
    for (let i = 0; i < devices.length; i += batchSize) {
      const batch = devices.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(devices.length / batchSize);

      console.log(`Processing batch ${batchNum}/${totalBatches} (${batch.length} devices)`);

      try {
        const result = await this.bulkIndexDocuments(
          INDICES.DEVICES,
          batch,
          'id'
        );

        stats.successfulIndexes += result.indexed;
        stats.failedIndexes += result.failed;
        stats.batchesProcessed++;

        if (result.errors && result.errors.length > 0) {
          errors.push(...result.errors);
          console.warn(`Batch ${batchNum} had ${result.errors.length} errors`);
        }
      } catch (error) {
        const batchError = error instanceof Error ? error.message : String(error);
        console.error(`Batch ${batchNum} failed completely:`, batchError);

        if (!continueOnError) {
          throw error;
        }

        // Record all documents in batch as failed
        for (const device of batch) {
          errors.push({
            id: device.id,
            error: batchError
          });
          stats.failedIndexes++;
        }
      }
    }

    // Refresh index if requested
    if (refresh) {
      await refreshIndex(this.client, INDICES.DEVICES);
    }

    stats.endTime = new Date();
    stats.durationMs = Date.now() - startTime;

    console.log(`Device ingest complete: ${stats.successfulIndexes} indexed, ${stats.failedIndexes} failed in ${stats.durationMs}ms`);

    return {
      success: stats.failedIndexes === 0,
      indexed: stats.successfulIndexes,
      failed: stats.failedIndexes,
      errors: errors.length > 0 ? errors : undefined,
      duration: stats.durationMs
    };
  }

  /**
   * Bulk index users into OpenSearch
   */
  async ingestUsers(
    users: UnifiedUserDocument[],
    options: {
      refresh?: boolean;
      batchSize?: number;
      continueOnError?: boolean;
    } = {}
  ): Promise<IngestResult> {
    const startTime = Date.now();
    const {
      refresh = false,
      batchSize = BULK_CONFIG.BATCH_SIZE,
      continueOnError = true
    } = options;

    console.log(`Starting user ingest: ${users.length} documents`);

    const stats: IngestStats = {
      totalDocuments: users.length,
      successfulIndexes: 0,
      failedIndexes: 0,
      batchesProcessed: 0,
      startTime: new Date()
    };

    const errors: Array<{ id: string; error: string }> = [];

    // Process in batches
    for (let i = 0; i < users.length; i += batchSize) {
      const batch = users.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(users.length / batchSize);

      console.log(`Processing batch ${batchNum}/${totalBatches} (${batch.length} users)`);

      try {
        const result = await this.bulkIndexDocuments(
          INDICES.USERS,
          batch,
          'id'
        );

        stats.successfulIndexes += result.indexed;
        stats.failedIndexes += result.failed;
        stats.batchesProcessed++;

        if (result.errors && result.errors.length > 0) {
          errors.push(...result.errors);
          console.warn(`Batch ${batchNum} had ${result.errors.length} errors`);
        }
      } catch (error) {
        const batchError = error instanceof Error ? error.message : String(error);
        console.error(`Batch ${batchNum} failed completely:`, batchError);

        if (!continueOnError) {
          throw error;
        }

        // Record all documents in batch as failed
        for (const user of batch) {
          errors.push({
            id: user.id,
            error: batchError
          });
          stats.failedIndexes++;
        }
      }
    }

    // Refresh index if requested
    if (refresh) {
      await refreshIndex(this.client, INDICES.USERS);
    }

    stats.endTime = new Date();
    stats.durationMs = Date.now() - startTime;

    console.log(`User ingest complete: ${stats.successfulIndexes} indexed, ${stats.failedIndexes} failed in ${stats.durationMs}ms`);

    return {
      success: stats.failedIndexes === 0,
      indexed: stats.successfulIndexes,
      failed: stats.failedIndexes,
      errors: errors.length > 0 ? errors : undefined,
      duration: stats.durationMs
    };
  }

  /**
   * Ingest licenses with stale data cleanup
   * Deletes licenses that weren't in the current batch (to handle canceled subscriptions)
   */
  async ingestLicenses(
    licenses: UnifiedLicenseDocument[],
    options: {
      refresh?: boolean;
      batchSize?: number;
      continueOnError?: boolean;
      mode?: 'upsert' | 'replace';
    } = {}
  ): Promise<IngestResult> {
    const batchTimestamp = new Date().toISOString();
    const startTime = Date.now();
    const {
      refresh = false,
      batchSize = BULK_CONFIG.BATCH_SIZE,
      continueOnError = true
    } = options;

    console.log(`Starting license ingest: ${licenses.length} documents`);

    // Add batch timestamp to all licenses
    const licensesWithTimestamp: UnifiedLicenseDocument[] = licenses.map(license => ({
      ...license,
      ingestion: {
        ...license.ingestion,
        timestamp: batchTimestamp
      }
    }));

    const stats: IngestStats = {
      totalDocuments: licenses.length,
      successfulIndexes: 0,
      failedIndexes: 0,
      batchesProcessed: 0,
      startTime: new Date()
    };

    const errors: Array<{ id: string; error: string }> = [];

    // Process in batches
    for (let i = 0; i < licensesWithTimestamp.length; i += batchSize) {
      const batch = licensesWithTimestamp.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(licensesWithTimestamp.length / batchSize);

      console.log(`Processing batch ${batchNum}/${totalBatches} (${batch.length} licenses)`);

      try {
        const result = await this.bulkIndexDocuments(
          INDICES.LICENSES,
          batch,
          'id'
        );

        stats.successfulIndexes += result.indexed;
        stats.failedIndexes += result.failed;
        stats.batchesProcessed++;

        if (result.errors && result.errors.length > 0) {
          errors.push(...result.errors);
          console.warn(`Batch ${batchNum} had ${result.errors.length} errors`);
        }
      } catch (error) {
        const batchError = error instanceof Error ? error.message : String(error);
        console.error(`Batch ${batchNum} failed completely:`, batchError);

        if (!continueOnError) {
          throw error;
        }

        // Record all documents in batch as failed
        for (const license of batch) {
          errors.push({
            id: license.id,
            error: batchError
          });
          stats.failedIndexes++;
        }
      }
    }

    // Delete stale licenses (not in current batch)
    // This handles canceled subscriptions that no longer appear in fetcher data
    try {
      console.log(`Cleaning up stale licenses (timestamp != ${batchTimestamp})`);
      const deleteResponse = await this.client.deleteByQuery({
        index: INDICES.LICENSES,
        body: {
          query: {
            bool: {
              must_not: [
                { term: { 'ingestion.timestamp': batchTimestamp } }
              ]
            }
          }
        }
      });

      const deletedCount = (deleteResponse.body as any).deleted || 0;
      console.log(`Deleted ${deletedCount} stale license records`);
    } catch (error) {
      console.warn('Failed to clean up stale licenses:', error);
      // Don't fail the entire ingest if cleanup fails
    }

    // Refresh index if requested
    if (refresh) {
      await refreshIndex(this.client, INDICES.LICENSES);
    }

    stats.endTime = new Date();
    stats.durationMs = Date.now() - startTime;

    console.log(`License ingest complete: ${stats.successfulIndexes} indexed, ${stats.failedIndexes} failed in ${stats.durationMs}ms`);

    return {
      success: stats.failedIndexes === 0,
      indexed: stats.successfulIndexes,
      failed: stats.failedIndexes,
      errors: errors.length > 0 ? errors : undefined,
      duration: stats.durationMs
    };
  }

  /**
   * Ingest Conditional Access Policies
   */
  async ingestConditionalAccessPolicies(
    policies: any[],
    options: {
      refresh?: boolean;
      batchSize?: number;
      continueOnError?: boolean;
    } = {}
  ): Promise<IngestResult> {
    const startTime = Date.now();
    const {
      refresh = false,
      batchSize = BULK_CONFIG.BATCH_SIZE,
      continueOnError = true
    } = options;

    console.log(`Starting CA policy ingest: ${policies.length} documents`);

    const stats: IngestStats = {
      totalDocuments: policies.length,
      successfulIndexes: 0,
      failedIndexes: 0,
      batchesProcessed: 0,
      startTime: new Date()
    };

    const errors: Array<{ id: string; error: string }> = [];

    // Normalize policies for storage
    const normalizedPolicies: ConditionalAccessPolicy[] = policies.map(p => ({
      id: p.id,
      displayName: p.displayName,
      state: p.state,
      createdDateTime: p.createdDateTime,
      modifiedDateTime: p.modifiedDateTime,
      conditions: p.conditions,
      grantControls: p.grantControls,
      sessionControls: p.sessionControls,
      indexedAt: new Date().toISOString()
    }));

    // Process in batches
    for (let i = 0; i < normalizedPolicies.length; i += batchSize) {
      const batch = normalizedPolicies.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(normalizedPolicies.length / batchSize);

      console.log(`Processing batch ${batchNum}/${totalBatches} (${batch.length} policies)`);

      try {
        const result = await this.bulkIndexDocuments(
          INDICES.CONDITIONAL_ACCESS_POLICIES,
          batch,
          'id'
        );

        stats.successfulIndexes += result.indexed;
        stats.failedIndexes += result.failed;
        stats.batchesProcessed++;

        if (result.errors && result.errors.length > 0) {
          errors.push(...result.errors);
          console.warn(`Batch ${batchNum} had ${result.errors.length} errors`);
        }
      } catch (error) {
        const batchError = error instanceof Error ? error.message : String(error);
        console.error(`Batch ${batchNum} failed completely:`, batchError);

        if (!continueOnError) {
          throw error;
        }

        for (const policy of batch) {
          errors.push({
            id: policy.id,
            error: batchError
          });
          stats.failedIndexes++;
        }
      }
    }

    if (refresh) {
      await refreshIndex(this.client, INDICES.CONDITIONAL_ACCESS_POLICIES);
    }

    stats.endTime = new Date();
    stats.durationMs = Date.now() - startTime;

    console.log(`CA Policy ingest complete: ${stats.successfulIndexes} indexed, ${stats.failedIndexes} failed in ${stats.durationMs}ms`);

    return {
      success: stats.failedIndexes === 0,
      indexed: stats.successfulIndexes,
      failed: stats.failedIndexes,
      errors: errors.length > 0 ? errors : undefined,
      duration: stats.durationMs
    };
  }

  /**
   * Ingest Experience Metrics
   */
  async ingestExperienceMetrics(
    metrics: ExperienceMetric[],
    options: { refresh?: boolean } = {}
  ): Promise<IngestResult> {
    const metricsWithTimestamp = metrics.map(m => ({
      ...m,
      ingestedAt: new Date().toISOString()
    }));

    const result = await this.bulkIndexDocuments(
      INDICES.EXPERIENCE_METRICS,
      metricsWithTimestamp,
      'id'
    );

    if (options.refresh) {
      await refreshIndex(this.client, INDICES.EXPERIENCE_METRICS);
    }

    return result;
  }

  /**
   * Ingest Experience Events
   */
  async ingestExperienceEvents(
    events: ExperienceEvent[],
    options: { refresh?: boolean } = {}
  ): Promise<IngestResult> {
    const eventsWithTimestamp = events.map(e => ({
      ...e,
      ingestedAt: new Date().toISOString()
    }));

    const result = await this.bulkIndexDocuments(
      INDICES.EXPERIENCE_EVENTS,
      eventsWithTimestamp,
      'id'
    );

    if (options.refresh) {
      await refreshIndex(this.client, INDICES.EXPERIENCE_EVENTS);
    }

    return result;
  }

  /**
   * Generic bulk indexing for any document type
   */
  private async bulkIndexDocuments<T extends Record<string, any>>(
    indexName: string,
    documents: T[],
    idField: keyof T
  ): Promise<IngestResult> {
    if (documents.length === 0) {
      return {
        success: true,
        indexed: 0,
        failed: 0,
        duration: 0
      };
    }

    const startTime = Date.now();
    const body: any[] = [];

    // Build bulk request body
    for (const doc of documents) {
      // Index action
      body.push({
        index: {
          _index: indexName,
          _id: doc[idField]
        }
      });
      // Document source
      body.push(doc);
    }

    try {
      const response = await this.client.bulk({
        body,
        refresh: false // Don't refresh immediately
      });

      const result = response.body;
      let indexed = 0;
      let failed = 0;
      const errors: Array<{ id: string; error: string }> = [];

      // Check each item in the bulk response
      if (result.items) {
        for (const item of result.items) {
          const action = item.index || item.create || item.update;
          if (!action) continue;

          if (action.error) {
            failed++;
            errors.push({
              id: action._id,
              error: JSON.stringify(action.error)
            });
          } else {
            indexed++;
          }
        }
      }

      return {
        success: failed === 0,
        indexed,
        failed,
        errors: errors.length > 0 ? errors : undefined,
        duration: Date.now() - startTime
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`Bulk indexing failed:`, errorMsg);

      // Return all documents as failed
      return {
        success: false,
        indexed: 0,
        failed: documents.length,
        errors: [{
          id: 'bulk_request',
          error: errorMsg
        }],
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Delete all documents from an index (useful for reindexing)
   */
  async clearIndex(indexName: string): Promise<boolean> {
    try {
      await this.client.deleteByQuery({
        index: indexName,
        body: {
          query: {
            match_all: {}
          }
        }
      });

      await refreshIndex(this.client, indexName);
      console.log(`Cleared index: ${indexName}`);
      return true;
    } catch (error) {
      console.error(`Failed to clear index ${indexName}:`, error);
      return false;
    }
  }

  /**
   * Update a single document (upsert)
   */
  async updateDocument<T extends Record<string, any>>(
    indexName: string,
    id: string,
    document: T,
    options: {
      refresh?: boolean;
      retry_on_conflict?: number;
    } = {}
  ): Promise<boolean> {
    try {
      await this.client.index({
        index: indexName,
        id,
        body: document,
        refresh: options.refresh
      });

      return true;
    } catch (error) {
      console.error(`Failed to update document ${id} in ${indexName}:`, error);
      return false;
    }
  }

  /**
   * Delete a single document
   */
  async deleteDocument(
    indexName: string,
    id: string,
    options: { refresh?: boolean } = {}
  ): Promise<boolean> {
    try {
      await this.client.delete({
        index: indexName,
        id,
        refresh: options.refresh
      });

      return true;
    } catch (error) {
      console.error(`Failed to delete document ${id} from ${indexName}:`, error);
      return false;
    }
  }

  /**
   * Get document count for an index
   */
  async getDocumentCount(indexName: string): Promise<number> {
    try {
      // Check if index exists first to avoid 404 error
      const exists = await this.client.indices.exists({ index: indexName });
      if (exists.statusCode === 404) {
        return 0;
      }

      const response = await this.client.count({
        index: indexName
      });

      return response.body.count;
    } catch (error) {
      // Return 0 on error (index not found or connection issue) instead of crashing
      return 0;
    }
  }
}
