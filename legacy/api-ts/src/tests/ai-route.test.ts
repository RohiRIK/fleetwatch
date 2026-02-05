import { describe, it, expect, mock, beforeEach } from "bun:test";
import { createAiRoutes } from "../routes/ai.routes";
import { agentExecutor } from "../services/ai-agent.service";

// Mock middleware
mock.module("../middleware/session-auth.middleware", () => ({
  requireAuth: () => (req: any, res: any, next: any) => {
    req.user = { id: "test-user", tenantId: "test-tenant" };
    next();
  }
}));

// Mock services
mock.module("../services/ai-agent.service", () => ({
  agentExecutor: {
    query: mock(async () => ({
      pipeDataStreamToResponse: mock(() => {})
    }))
  }
}));

describe("AI Route Fix Verification", () => {
  it("should process the request and call pipeDataStreamToResponse", async () => {
    const mockClient: any = {};
    const router: any = createAiRoutes(mockClient);
    
    const queryLayer = router.stack.find((s: any) => s.route?.path === '/query' && s.route?.methods?.post);
    const handler = queryLayer.route.stack[queryLayer.route.stack.length - 1].handle;

    const req: any = {
      body: {
        prompt: "Hello",
        provider: "openai",
        model: "gpt-4o"
      }
    };
    const res: any = {
      status: mock(() => res),
      json: mock(() => res)
    };
    
    await handler(req, res, () => {});
    
    expect(agentExecutor.query).toHaveBeenCalled();
    const result = await (agentExecutor.query as any).mock.results[0].value;
    expect(result.pipeDataStreamToResponse).toHaveBeenCalledWith(res);
  });

  it("should correctly extract prompt from multipart messages", async () => {
    const mockClient: any = {};
    const router: any = createAiRoutes(mockClient);
    const queryLayer = router.stack.find((s: any) => s.route?.path === '/query' && s.route?.methods?.post);
    const handler = queryLayer.route.stack[queryLayer.route.stack.length - 1].handle;

    const req: any = {
      body: {
        messages: [
          { role: 'user', parts: [{ type: 'text', text: 'Analyze this device' }] }
        ]
      }
    };
    const res: any = {
      status: mock(() => res),
      json: mock(() => res)
    };
    
    await handler(req, res, () => {});
    
    expect(agentExecutor.query).toHaveBeenCalledWith(
      "Analyze this device",
      expect.anything(),
      expect.anything()
    );
  });
});
