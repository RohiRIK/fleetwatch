import { createOpenSearchClient, INDICES } from '../config/opensearch';

export interface SystemContext {
  totalDevices: number;
  compliantDevices: number;
  complianceScore: number;
  activeAlerts: number;
  lastUpdated: string;
}

export class SystemContextService {
  private client = createOpenSearchClient();
  private cache: SystemContext | null = null;
  private lastFetch = 0;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  async getContext(): Promise<SystemContext> {
    const now = Date.now();
    if (this.cache && (now - this.lastFetch < this.CACHE_TTL)) {
      return this.cache;
    }

    try {
      const [hasDevices, hasAlerts] = await Promise.all([
        this.client.indices.exists({ index: INDICES.DEVICES }).then(r => r.statusCode === 200),
        this.client.indices.exists({ index: INDICES.ALERTS }).then(r => r.statusCode === 200)
      ]);

      // Parallel fetch with fallback for missing indices
      const [devicesResp, alertsResp] = await Promise.all([
        hasDevices ? this.client.search({
          index: INDICES.DEVICES,
          body: {
            size: 0,
            aggs: {
              compliant_count: {
                filter: { term: { isCompliant: true } }
              }
            },
            track_total_hits: true
          }
        }) : Promise.resolve({ body: { hits: { total: { value: 0 } }, aggregations: { compliant_count: { doc_count: 0 } } } }),
        hasAlerts ? this.client.count({ index: INDICES.ALERTS }) : Promise.resolve({ body: { count: 0 } })
      ]);

      const totalDevices = (devicesResp as any).body.hits.total.value;
      const compliantDevices = ((devicesResp as any).body.aggregations.compliant_count as any).doc_count;
      const activeAlerts = (alertsResp as any).body.count;

      const complianceScore = totalDevices > 0 
        ? Math.round((compliantDevices / totalDevices) * 100)
        : 100;

      this.cache = {
        totalDevices,
        compliantDevices,
        complianceScore,
        activeAlerts,
        lastUpdated: new Date().toLocaleTimeString()
      };
      this.lastFetch = now;

      return this.cache;
    } catch (error) {
      console.error('Failed to fetch system context:', error);
      // Return empty/safe context on error
      return {
        totalDevices: 0,
        compliantDevices: 0,
        complianceScore: 0,
        activeAlerts: 0,
        lastUpdated: new Date().toLocaleTimeString()
      };
    }
  }

  getPromptPreamble(context: SystemContext): string {
    return `
Current Platform Status:
- Total Devices: ${context.totalDevices}
- Overall Compliance: ${context.complianceScore}%
- Active Alerts: ${context.activeAlerts}
- Data Updated: ${context.lastUpdated}
`;
  }
}

export const systemContextService = new SystemContextService();
