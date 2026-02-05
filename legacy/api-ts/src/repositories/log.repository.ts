import { Client } from '@opensearch-project/opensearch';
import { LogEntry, LogType } from '../types/log.types';
import { INDICES } from '../config/opensearch';

export class LogRepository {
  private client: Client;

  constructor(client: Client) {
    this.client = client;
  }

  /**
   * Get the index pattern for a specific log type
   */
  private getIndexPattern(type: LogType): string {
    switch (type) {
      case LogType.SYSTEM:
        return 'logs-system-*';
      case LogType.USER:
        return 'logs-user-*';
      case LogType.ENTRA:
        return 'logs-entra-*';
      default:
        return INDICES.LOGS;
    }
  }

  /**
   * Get the write index for a specific log type (based on current date)
   */
  private getWriteIndex(type: LogType): string {
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    switch (type) {
      case LogType.SYSTEM:
        return `logs-system-${date}`;
      case LogType.USER:
        return `logs-user-${date}`;
      case LogType.ENTRA:
        return `logs-entra-${date}`;
      default:
        return INDICES.LOGS;
    }
  }

  /**
   * Fetches log entries with pagination and filtering.
   */
  public async getLogs(params: {
    type?: LogType;
    page?: number;
    limit?: number;
    severity?: string;
    source?: string;
    search?: string;
    user_upn?: string;
    category?: string;
    status?: string;
  }): Promise<{ data: LogEntry[]; total: number; pages: number }> {
    const { 
      type = LogType.SYSTEM, 
      page = 1, 
      limit = 10, 
      severity, 
      source, 
      search,
      user_upn,
      category,
      status
    } = params;
    
    const from = (page - 1) * limit;
    const index = this.getIndexPattern(type);

    const query: any = {
      index,
      body: {
        sort: [{ timestamp: { order: 'desc' } }],
        from,
        size: limit,
        query: {
          bool: {
            filter: [],
            must: []
          },
        },
      },
    };

    // System Log filters
    if (severity) {
      (query.body.query.bool.filter as any[]).push({ term: { severity: severity.toLowerCase() } });
    }
    if (source) {
      (query.body.query.bool.filter as any[]).push({ term: { source: source.toLowerCase() } });
    }

    // User/Entra Log filters
    if (user_upn) {
      (query.body.query.bool.filter as any[]).push({ term: { user_upn: user_upn.toLowerCase() } });
    }
    if (category) {
      (query.body.query.bool.filter as any[]).push({ term: { category } });
    }
    if (status) {
      (query.body.query.bool.filter as any[]).push({ term: { status } });
    }

    if (search) {
        (query.body.query.bool.must as any[]).push({
            multi_match: {
                query: search,
                fields: ["message", "action", "result_description", "user_upn", "metadata.*", "details.*"]
            }
        });
    }

    try {
      const response = await this.client.search(query);
      const hits = response.body.hits.hits;
      const total = typeof response.body.hits.total === 'object' 
        ? response.body.hits.total.value 
        : response.body.hits.total;
      
      const data = hits.map((hit: any) => ({
        ...hit._source,
        id: hit._id || hit._source.id // Ensure ID is present
      } as LogEntry));
      
      const pages = Math.ceil(total / limit);

      return { data, total, pages };
    } catch (error: any) {
      // If index doesn't exist yet, return empty
      if (error.statusCode === 404) {
        return { data: [], total: 0, pages: 0 };
      }
      console.error('Error fetching logs from OpenSearch:', error);
      return { data: [], total: 0, pages: 0 };
    }
  }

  /**
   * Create a new log entry.
   */
  public async createLog(
    log: Omit<LogEntry, 'id' | 'timestamp'>, 
    type: LogType = LogType.SYSTEM
  ): Promise<string> {
    const id = crypto.randomUUID();
    const timestamp = new Date().toISOString();
    const entry = {
      ...log,
      id,
      timestamp
    };

    const index = this.getWriteIndex(type);

    await this.client.index({
      index,
      body: entry,
      refresh: true
    });

    return id;
  }

  /**
   * Bulk create log entries
   */
  public async bulkCreateLogs(
    logs: LogEntry[],
    type: LogType
  ): Promise<{ successCount: number; failedCount: number }> {
    if (logs.length === 0) return { successCount: 0, failedCount: 0 };

    const index = this.getWriteIndex(type);
    const body = logs.flatMap(log => [
      { index: { _index: index } },
      { 
        ...log, 
        id: log.id || crypto.randomUUID(), 
        timestamp: log.timestamp || new Date().toISOString() 
      }
    ]);

    const response = await this.client.bulk({
      body,
      refresh: true
    });

    if (response.body.errors) {
      const failedCount = response.body.items.filter((item: any) => item.index && item.index.error).length;
      return { 
        successCount: logs.length - failedCount, 
        failedCount 
      };
    }

    return { successCount: logs.length, failedCount: 0 };
  }

  /**
   * Stream logs for export using scroll API
   */
  public async *streamLogs(params: {
    type?: LogType;
    severity?: string;
    from_date?: string;
    batch_size?: number;
  }): AsyncGenerator<LogEntry> {
    const { type = LogType.SYSTEM, severity, from_date, batch_size = 500 } = params;
    const index = this.getIndexPattern(type);

    const query: any = {
      bool: {
        filter: [],
      }
    };

    if (severity) {
      query.bool.filter.push({ term: { severity: severity.toLowerCase() } });
    }

    if (from_date) {
      query.bool.filter.push({
        range: {
          timestamp: { gte: from_date }
        }
      });
    }

    let response = await this.client.search({
      index,
      scroll: '1m',
      size: batch_size,
      body: {
        query,
        sort: [{ timestamp: { order: 'asc' } }]
      }
    });

    let scrollId = response.body._scroll_id;
    let hits = response.body.hits.hits;

    try {
      while (hits && hits.length > 0) {
        for (const hit of hits) {
          yield {
            ...hit._source,
            id: hit._id
          } as LogEntry;
        }

        response = await this.client.scroll({
          scroll_id: scrollId,
          scroll: '1m'
        });

        scrollId = response.body._scroll_id;
        hits = response.body.hits.hits;
      }
    } finally {
      if (scrollId) {
        await this.client.clearScroll({ scroll_id: scrollId }).catch(() => {});
      }
    }
  }
}
