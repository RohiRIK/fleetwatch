import { ConditionalAccessRepository } from '../repositories/conditional-access.repository';
import { ConditionalAccessPolicy } from '../schemas/conditional-access.schema';

export class ConditionalAccessService {
  constructor(private repository: ConditionalAccessRepository) {}

  /**
   * List policies
   */
  async listPolicies(params: {
    page?: number;
    limit?: number;
    search?: string;
    state?: string;
  }): Promise<{ data: ConditionalAccessPolicy[]; total: number; pages: number }> {
    return this.repository.listPolicies(params);
  }

  /**
   * Get policy by ID
   */
  async getPolicyById(id: string): Promise<ConditionalAccessPolicy | null> {
    return this.repository.getPolicyById(id);
  }
}
