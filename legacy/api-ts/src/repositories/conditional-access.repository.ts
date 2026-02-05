import { Client } from '@opensearch-project/opensearch';
import { INDICES } from '../config/opensearch';
import { ConditionalAccessPolicy } from '../schemas/conditional-access.schema';

export class ConditionalAccessRepository {
  private client: Client;

  constructor(client: Client) {
    this.client = client;
  }

  /**
   * List policies with pagination and filtering
   */
  public async listPolicies(params: {
    page?: number;
    limit?: number;
    search?: string;
    state?: string;
  }): Promise<{ data: ConditionalAccessPolicy[]; total: number; pages: number }> {
    const { page = 1, limit = 10, search, state } = params;
    const from = (page - 1) * limit;

    const query: any = {
      index: INDICES.CONDITIONAL_ACCESS_POLICIES,
      body: {
        sort: [{ 'displayName.keyword': { order: 'asc' } }], // Sort by name keyword
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

    if (state) {
      (query.body.query.bool.filter as any[]).push({ term: { state } });
    }

    if (search) {
      (query.body.query.bool.must as any[]).push({
        multi_match: {
          query: search,
          fields: ["displayName", "id"]
        }
      });
    }

    try {
      const response = await this.client.search(query);
      const hits = response.body.hits.hits;
      const total = typeof response.body.hits.total === 'object' 
        ? response.body.hits.total.value 
        : response.body.hits.total;
      
      const data = hits.map((hit: any) => hit._source as ConditionalAccessPolicy);
      const pages = Math.ceil(total / limit);

      return { data, total, pages };
    } catch (error: any) {
      if (error.meta && error.meta.statusCode === 404) {
        return { data: [], total: 0, pages: 0 };
      }
      console.error('Error fetching CA policies:', error);
      throw error;
    }
  }

  /**
   * Get policy by ID
   */
  public async getPolicyById(id: string): Promise<ConditionalAccessPolicy | null> {
    try {
      const response = await this.client.get({
        index: INDICES.CONDITIONAL_ACCESS_POLICIES,
        id
      });
      return response.body._source as ConditionalAccessPolicy;
    } catch (error: any) {
      if (error.meta && error.meta.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }
}
