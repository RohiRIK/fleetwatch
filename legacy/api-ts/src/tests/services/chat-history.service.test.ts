import { describe, it, expect, mock, beforeEach } from "bun:test";

mock.module("../../services/redis-session.service", () => ({
  redisSessionService: {
    getClient: mock(() => null)
  }
}));

import { ChatHistoryService } from "../../services/chat-history.service";
import { redisSessionService } from "../../services/redis-session.service";

// Mock data
const mockTenantId = "tenant-123";
const mockUserId = "user-456";
const mockMessage: any = { role: "user", content: "hello" };

describe("ChatHistoryService", () => {
  let service: ChatHistoryService;
  let mockRedis: any;

  beforeEach(() => {
    mockRedis = {
      multi: mock(() => mockRedis),
      rpush: mock(() => mockRedis),
      ltrim: mock(() => mockRedis),
      expire: mock(() => mockRedis),
      exec: mock(() => Promise.resolve([])),
      lrange: mock(() => Promise.resolve([])),
      del: mock(() => Promise.resolve(1))
    };

    service = new ChatHistoryService(mockRedis);
  });

  it("should save a message with LTRIM and EXPIRE", async () => {
    await service.saveMessage(mockTenantId, mockUserId, mockMessage);

    expect(mockRedis.multi).toHaveBeenCalled();
    expect(mockRedis.rpush).toHaveBeenCalledWith(`chat:${mockTenantId}:${mockUserId}`, JSON.stringify(mockMessage));
    expect(mockRedis.ltrim).toHaveBeenCalledWith(`chat:${mockTenantId}:${mockUserId}`, -100, -1);
    expect(mockRedis.expire).toHaveBeenCalledWith(`chat:${mockTenantId}:${mockUserId}`, 7 * 24 * 60 * 60);
    expect(mockRedis.exec).toHaveBeenCalled();
  });

  it("should retrieve history and parse JSON", async () => {
    const rawMessages = [JSON.stringify(mockMessage)];
    mockRedis.lrange = mock(() => Promise.resolve(rawMessages));

    const history = await service.getHistory(mockTenantId, mockUserId);

    expect(mockRedis.lrange).toHaveBeenCalledWith(`chat:${mockTenantId}:${mockUserId}`, 0, -1);
    expect(history).toEqual([mockMessage]);
  });

  it("should clear history", async () => {
    await service.clearHistory(mockTenantId, mockUserId);
    expect(mockRedis.del).toHaveBeenCalledWith(`chat:${mockTenantId}:${mockUserId}`);
  });
});
