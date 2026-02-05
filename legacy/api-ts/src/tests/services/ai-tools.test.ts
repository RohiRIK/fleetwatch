import { describe, it, expect, mock, beforeEach } from "bun:test";
import { aiToolsService } from "../../services/ai-tools.service";
import { z } from "zod";

describe("AIToolsService", () => {
  let context: any;
  let mockSearch: any;
  let mockGet: any;

  beforeEach(() => {
    mockSearch = mock(() => Promise.resolve({
      body: {
        hits: {
          hits: [],
          total: { value: 0 }
        }
      }
    }));
    mockGet = mock(() => Promise.resolve({
      body: {
        _source: {}
      }
    }));

    context = {
      opensearchClient: {
        search: mockSearch,
        get: mockGet
      },
      tenantId: "test-tenant",
      userId: "test-user"
    };
  });

  it("should have a registry with tools that have strictly typed parameters", () => {
    const registry = aiToolsService.getRegistry();
    const toolNames = Object.keys(registry);
    expect(toolNames.length).toBeGreaterThan(0);

    for (const name of toolNames) {
      const tool = registry[name];
      expect(tool.parameters).toBeInstanceOf(z.ZodType);
    }
  });

  it("should validate Zod schemas correctly", () => {
      const registry = aiToolsService.getRegistry();
      const searchTool = registry['search_devices'];
      
      // Should pass valid schema
      const validParams = { query: 'laptop', limit: 5 };
      expect(searchTool.parameters.parse(validParams)).toEqual(validParams);
      
      // Should fail invalid schema
      expect(() => searchTool.parameters.parse({ query: 123 })).toThrow();
  });

    it("should return JSON data structure from search_devices", async () => {
    const registry = aiToolsService.getRegistry();
    const searchTool = registry['search_devices'];

    mockSearch.mockResolvedValueOnce({
      body: {
        hits: {
          hits: [
            { _source: { deviceName: 'Laptop-1', os: 'Windows' } },
            { _source: { deviceName: 'MacBook-Pro', os: 'macOS' } }
          ]
        }
      }
    });

    const result = await searchTool.execute({ query: 'laptop' }, context);
    
    expect(Array.isArray(result)).toBe(true);
    expect(result[0]).toEqual({ deviceName: 'Laptop-1', os: 'Windows' });
    expect(typeof result).not.toBe('string');
  });

  it("should return JSON data structure from get_user_activity", async () => {
    const registry = aiToolsService.getRegistry();
    const tool = registry['get_user_activity'];

    mockSearch.mockResolvedValueOnce({
        body: {
            hits: {
                hits: [
                    { _source: { category: 'SignIn', user_upn: 'test@example.com' } }
                ]
            }
        }
    });

    const result = await tool.execute({ upn: 'test@example.com' }, context);
    expect(Array.isArray(result)).toBe(true);
    expect(result[0]).toEqual({ category: 'SignIn', user_upn: 'test@example.com' });
  });

  it("should return detailed device info from get_device_detail", async () => {
    const registry = aiToolsService.getRegistry();
    const tool = registry['get_device_detail'];

    mockGet.mockResolvedValueOnce({
      body: {
        _source: { deviceId: '123', deviceName: 'DetailDevice', os: 'iOS' }
      }
    });

    const result = await tool.execute({ deviceId: '123' }, context);
    expect(result).toEqual({ deviceId: '123', deviceName: 'DetailDevice', os: 'iOS' });
    expect(mockGet).toHaveBeenCalledWith(expect.objectContaining({ index: 'devices_v2', id: '123' }));
  });

  it("should return aggregated counts from count_devices", async () => {
    const registry = aiToolsService.getRegistry();
    const tool = registry['count_devices'];

    // Mock count response
    // Or if it uses the count API directly, we might need to mock a different method or use search with size 0 + track_total_hits
    // Let's assume implementation will use client.count or client.search({ size: 0 })
    // If client.count is used, we need to mock it.
    // If client.search is used:
    mockSearch.mockResolvedValueOnce({
      body: {
        hits: {
          total: { value: 42 }
        }
      }
    });

    const result = await tool.execute({ os: 'Windows' }, context);
    expect(result).toBe(42);
  });

  it("should list users with filters", async () => {
    const registry = aiToolsService.getRegistry();
    const tool = registry['list_users'];
    
    // Check if tool exists
    expect(tool).toBeDefined();

    mockSearch.mockResolvedValueOnce({
      body: {
        hits: {
          hits: [
            { _source: { id: 'u1', displayName: 'User 1', department: 'IT' } }
          ]
        }
      }
    });

    const result = await tool.execute({ department: 'IT' }, context);
    expect(result[0].department).toBe('IT');
  });

  it("should get user devices", async () => {
    const registry = aiToolsService.getRegistry();
    // Plan says get_user_devices, checking if we use that or list_user_devices
    const tool = registry['get_user_devices'];
    
    // Check if tool exists
    expect(tool).toBeDefined();

    mockSearch.mockResolvedValueOnce({
      body: {
        hits: {
          hits: [
            { _source: { deviceName: 'Laptop-1' } }
          ]
        }
      }
    });

    const result = await tool.execute({ upn: 'user@example.com' }, context);
    expect(result[0].deviceName).toBe('Laptop-1');
  });

  it("should check compliance status", async () => {
    const registry = aiToolsService.getRegistry();
    const tool = registry['check_compliance_status'];
    expect(tool).toBeDefined();

    mockGet.mockResolvedValueOnce({
      body: {
        _source: { 
          isCompliant: false, 
          complianceState: 'non_compliant',
          compliance: { policies: [{ name: 'BitLocker', status: 'error' }] }
        }
      }
    });

    const result = await tool.execute({ deviceId: '123' }, context);
    expect(result.isCompliant).toBe(false);
    expect(result.policies[0].name).toBe('BitLocker');
  });

  it("should get threat status", async () => {
    const registry = aiToolsService.getRegistry();
    const tool = registry['get_threat_status'];
    expect(tool).toBeDefined();

    mockSearch.mockResolvedValueOnce({
      body: {
        hits: {
          hits: [
            { _source: { alert: 'Malware detected', severity: 'High' } }
          ]
        }
      }
    });

    const result = await tool.execute({ deviceId: '123' }, context);
    expect(result.alerts[0].alert).toBe('Malware detected');
  });

  it("should list non-compliant devices", async () => {
    const registry = aiToolsService.getRegistry();
    const tool = registry['list_non_compliant_devices'];
    expect(tool).toBeDefined();

    mockSearch.mockResolvedValueOnce({
      body: {
        hits: {
          hits: [
            { _source: { deviceName: 'Infected-PC', complianceState: 'non_compliant' } }
          ]
        }
      }
    });

    const result = await tool.execute({ reason: 'BitLocker' }, context);
    expect(result[0].deviceName).toBe('Infected-PC');
  });

  it("should explain policy", async () => {
    const registry = aiToolsService.getRegistry();
    const tool = registry['explain_policy'];
    expect(tool).toBeDefined();

    mockSearch.mockResolvedValueOnce({
      body: {
        hits: {
          hits: [
            { _source: { displayName: 'Win10-Secure', settings: [{ key: 'BitLocker', value: 'Enabled' }] } }
          ]
        }
      }
    });

    const result = await tool.execute({ policyName: 'Win10' }, context);
    expect(result[0].name).toBe('Win10-Secure');
    expect(result[0].settings[0].key).toBe('BitLocker');
  });

});
