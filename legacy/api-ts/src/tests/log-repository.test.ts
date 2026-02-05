import { describe, it, expect, mock } from "bun:test";
import { LogRepository } from "../repositories/log.repository";
import { LogType } from "../types/log.types";

// Mock OpenSearch Client
const mockOpenSearchClient = {
  index: mock(() => Promise.resolve({ body: { result: 'created' } })),
  search: mock(() => Promise.resolve({
    body: {
      hits: {
        total: { value: 1 },
        hits: [{
          _source: {
            id: 'test-id',
            timestamp: new Date().toISOString(),
            severity: 'info',
            message: 'test message',
            action: 'test action',
            source: 'system'
          }
        }]
      }
    }
  }))
};

describe("LogRepository", () => {
  const repository = new LogRepository(mockOpenSearchClient as any);

  it("should create a system log in the correct daily index", async () => {
    const log = {
      severity: 'info' as const,
      message: 'system starting',
      action: 'Startup',
      source: 'system',
      service: 'test-service'
    };

    const id = await repository.createLog(log as any, LogType.SYSTEM);
    
    expect(id).toBeDefined();
    expect(mockOpenSearchClient.index).toHaveBeenCalled();
    
    const callArgs = (mockOpenSearchClient.index as any).mock.calls[0][0];
    expect(callArgs.index).toMatch(/^logs-system-\d{4}-\d{2}-\d{2}$/);
    expect(callArgs.body.message).toBe('system starting');
  });

  it("should create a user log in the correct daily index", async () => {
    const log = {
      user_upn: 'admin@example.com',
      action: 'Login',
      ip_address: '127.0.0.1'
    };

    const id = await repository.createLog(log as any, LogType.USER);
    
    expect(id).toBeDefined();
    const callArgs = (mockOpenSearchClient.index as any).mock.calls[1][0];
    expect(callArgs.index).toMatch(/^logs-user-\d{4}-\d{2}-\d{2}$/);
    expect(callArgs.body.user_upn).toBe('admin@example.com');
  });

  it("should fetch logs with the correct index pattern", async () => {
    await repository.getLogs({ type: LogType.ENTRA, limit: 5 });
    
    expect(mockOpenSearchClient.search).toHaveBeenCalled();
    const callArgs = (mockOpenSearchClient.search as any).mock.calls[0][0];
    expect(callArgs.index).toBe('logs-entra-*');
    expect(callArgs.body.size).toBe(5);
  });
});
