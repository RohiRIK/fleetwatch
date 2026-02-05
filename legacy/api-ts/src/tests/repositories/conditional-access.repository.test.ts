import { describe, it, expect, mock } from "bun:test";
import { ConditionalAccessRepository } from "../../repositories/conditional-access.repository";
import { INDICES } from "../../config/opensearch";

// Mock OpenSearch Client
const mockOpenSearchClient = {
  search: mock(() => Promise.resolve({
    body: {
      hits: {
        total: { value: 1 },
        hits: [{
          _source: {
            id: 'test-policy-id',
            displayName: 'Test Policy',
            state: 'enabled',
            createdDateTime: new Date().toISOString(),
            modifiedDateTime: new Date().toISOString()
          }
        }]
      }
    }
  })),
  get: mock(() => Promise.resolve({
    body: {
      _source: {
        id: 'test-policy-id',
        displayName: 'Test Policy',
        state: 'enabled'
      }
    }
  }))
};

describe("ConditionalAccessRepository", () => {
  const repository = new ConditionalAccessRepository(mockOpenSearchClient as any);

  it("should list policies", async () => {
    const result = await repository.listPolicies({ page: 1, limit: 10 });
    
    expect(result.data.length).toBe(1);
    expect(result.total).toBe(1);
    expect(mockOpenSearchClient.search).toHaveBeenCalled();
    const callArgs = (mockOpenSearchClient.search as any).mock.lastCall[0];
    expect(callArgs.index).toBe(INDICES.CONDITIONAL_ACCESS_POLICIES);
  });

  it("should get a policy by id", async () => {
    const policy = await repository.getPolicyById('test-policy-id');
    
    expect(policy).toBeDefined();
    expect(policy?.id).toBe('test-policy-id');
    expect(mockOpenSearchClient.get).toHaveBeenCalled();
    const callArgs = (mockOpenSearchClient.get as any).mock.lastCall[0];
    expect(callArgs.index).toBe(INDICES.CONDITIONAL_ACCESS_POLICIES);
    expect(callArgs.id).toBe('test-policy-id');
  });
});
