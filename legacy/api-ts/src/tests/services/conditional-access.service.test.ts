import { describe, it, expect, mock, beforeEach } from "bun:test";
import { ConditionalAccessService } from "../../services/conditional-access.service";

// Mock Repository
const mockRepo = {
  listPolicies: mock(() => Promise.resolve({
    data: [{ id: 'policy-1', displayName: 'Policy 1', state: 'enabled' }],
    total: 1,
    pages: 1
  })),
  getPolicyById: mock((id) => Promise.resolve(
    id === 'policy-1' 
      ? { id: 'policy-1', displayName: 'Policy 1', state: 'enabled' } 
      : null
  ))
};

describe("ConditionalAccessService", () => {
  let service: ConditionalAccessService;

  beforeEach(() => {
    service = new ConditionalAccessService(mockRepo as any);
  });

  it("should list policies", async () => {
    const result = await service.listPolicies({});
    expect(result.data.length).toBe(1);
    expect(mockRepo.listPolicies).toHaveBeenCalled();
  });

  it("should get policy by id", async () => {
    const policy = await service.getPolicyById('policy-1');
    expect(policy).toBeDefined();
    expect(policy?.id).toBe('policy-1');
    expect(mockRepo.getPolicyById).toHaveBeenCalledWith('policy-1');
  });

  it("should return null for non-existent policy", async () => {
    const policy = await service.getPolicyById('non-existent');
    expect(policy).toBeNull();
  });
});
