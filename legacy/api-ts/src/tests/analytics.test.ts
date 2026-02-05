import { describe, it, expect, mock } from "bun:test";
import { createAnalyticsRoutes } from "../routes/analytics.routes";

describe("Analytics Routes - UX Integration", () => {
  it("should query experience_metrics for device analytics", async () => {
    const mockClient: any = {
      search: mock(async () => ({
        body: {
          hits: {
            total: { value: 1 },
            hits: [
              { _source: { deviceId: "test-device", metricType: "startup", score: 95 } }
            ]
          }
        }
      }))
    };

    const router: any = createAnalyticsRoutes(mockClient);
    // Find the /device/:id GET route handler
    const route = router.stack.find((s: any) => s.route?.path === '/device/:id' && s.route?.methods?.get);
    const handler = route.route.stack[0].handle;

    const req: any = { params: { id: "test-device" }, query: {} };
    const res: any = {
      json: mock((data) => {
        expect(data.success).toBe(true);
        expect(data.data).toHaveLength(1);
        expect(data.data[0].score).toBe(95);
      })
    };

    await handler(req, res, () => {});
    
    // Verify it queried the correct index
    expect(mockClient.search).toHaveBeenCalledWith(expect.objectContaining({
      index: 'experience_metrics'
    }));
  });

  it("should query experience_events for timeline", async () => {
    const mockClient: any = {
      search: mock(async () => ({
        body: {
          hits: {
            total: { value: 1 },
            hits: [
              { _source: { deviceId: "test-device", eventType: "crash", title: "App Crash" } }
            ]
          }
        }
      }))
    };

    const router: any = createAnalyticsRoutes(mockClient);
    const route = router.stack.find((s: any) => s.route?.path === '/events/:id' && s.route?.methods?.get);
    const handler = route.route.stack[0].handle;

    const req: any = { params: { id: "test-device" }, query: {} };
    const res: any = {
      json: mock((data) => {
        expect(data.success).toBe(true);
        expect(data.data[0].eventType).toBe("crash");
      })
    };

    await handler(req, res, () => {});
    
    expect(mockClient.search).toHaveBeenCalledWith(expect.objectContaining({
      index: 'experience_events'
    }));
  });
});
