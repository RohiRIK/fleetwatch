import { z } from 'zod';
import { INDICES } from '../config/opensearch';
import { ReadOnlyTool, ToolContext, ToolRegistry } from '../types/ai.types';

/**
 * AI Tools Service
 * 
 * Facade that provides read-only data access tools for the AI Analyst.
 * Every tool uses Zod for validation and performs optimized OpenSearch queries.
 */
export class AIToolsService {
  /**
   * Get the complete registry of AI tools
   */
  public getRegistry(): ToolRegistry {
    return {
      // --- IDENTITY TOOLS ---
      
      search_users: {
        name: 'search_users',
        description: 'Fuzzy search for employees by name, email, or job title. Returns basic profiles.',
        parameters: z.object({
          query: z.string().describe('The search term (name, email, or title)'),
          limit: z.number().optional().default(5).describe('Max results to return')
        }),
        execute: async ({ query, limit }, context) => {
          const response = await context.opensearchClient.search({
            index: INDICES.USERS,
            body: {
              query: {
                multi_match: {
                  query,
                  fields: ['displayName^3', 'userPrincipalName^2', 'mail^2', 'jobTitle', 'department'],
                  fuzziness: 'AUTO'
                }
              },
              size: limit,
              _source: ['id', 'displayName', 'userPrincipalName', 'jobTitle', 'department', 'accountEnabled']
            }
          });
          return response.body.hits.hits.map((h: any) => h._source);
        }
      },

      get_user_details_deep: {
        name: 'get_user_details_deep',
        description: 'Retrieve full profile, group memberships, and assigned licenses for a specific user ID or UPN.',
        parameters: z.object({
          userId: z.string().describe('The GUID or email/UPN of the user')
        }),
        execute: async ({ userId }, context) => {
          // Try ID first, then UPN search (similar to users.routes.ts logic)
          let user = null;
          try {
            const resp = await context.opensearchClient.get({ index: INDICES.USERS, id: userId });
            user = resp.body._source;
          } catch (e) {
            if (userId.includes('@')) {
              const searchResp = await context.opensearchClient.search({
                index: INDICES.USERS,
                body: { query: { term: { 'userPrincipalName.keyword': userId } }, size: 1 }
              });
              if (searchResp.body.hits.total.value > 0) {
                user = searchResp.body.hits.hits[0]._source;
              }
            }
          }
          return user;
        }
      },

      get_user_activity: {
        name: 'get_user_activity',
        description: 'Fetch the most recent sign-in events for a specific user to analyze access patterns or failures.',
        parameters: z.object({
          upn: z.string().describe('The email/UPN of the user'),
          limit: z.number().optional().default(10)
        }),
        execute: async ({ upn, limit }, context) => {
          const response = await context.opensearchClient.search({
            index: 'logs-entra-*',
            body: {
              query: {
                bool: {
                  must: [
                    { term: { 'user_upn.keyword': upn.toLowerCase() } },
                    { term: { category: 'SignIn' } }
                  ]
                }
              },
              sort: [{ timestamp: 'desc' }],
              size: limit
            }
          });
          return response.body.hits.hits.map((h: any) => h._source);
        }
      },

      list_users: {
        name: 'list_users',
        description: 'List users with specific filters like department, job title, or account status.',
        parameters: z.object({
          department: z.string().optional(),
          jobTitle: z.string().optional(),
          accountEnabled: z.boolean().optional(),
          limit: z.number().optional().default(20)
        }),
        execute: async ({ department, jobTitle, accountEnabled, limit }, context) => {
          const must: any[] = [];
          if (department) must.push({ match: { department } });
          if (jobTitle) must.push({ match: { jobTitle } });
          if (accountEnabled !== undefined) must.push({ term: { accountEnabled } });

          const response = await context.opensearchClient.search({
            index: INDICES.USERS,
            body: {
              query: { bool: { must } },
              size: limit,
              _source: ['id', 'displayName', 'userPrincipalName', 'jobTitle', 'department', 'accountEnabled']
            }
          });
          return response.body.hits.hits.map((h: any) => h._source);
        }
      },

      get_user_groups: {
        name: 'get_user_groups',
        description: 'List the directory groups a user belongs to.',
        parameters: z.object({
          userId: z.string().describe('User GUID or UPN')
        }),
        execute: async ({ userId }, context) => {
          // In our schema, groups are often enriched into the user doc or checked via memberOf in fetcher.
          // For now, we return the 'groups' or 'memberOf' field if it exists in the user doc.
          const user: any = await this.getRegistry().get_user_details_deep.execute({ userId }, context);
          return user?.memberOf || user?.groups || [];
        }
      },

      // --- DEVICE TOOLS ---

      get_device_detail: {
        name: 'get_device_detail',
        description: 'Retrieve the full technical details for a specific device by its ID.',
        parameters: z.object({
          deviceId: z.string().describe('Unique ID of the device')
        }),
        execute: async ({ deviceId }, context) => {
          try {
            const response = await context.opensearchClient.get({
              index: INDICES.DEVICES,
              id: deviceId
            });
            return response.body._source;
          } catch (e) {
            return null;
          }
        }
      },

      count_devices: {
        name: 'count_devices',
        description: 'Get an aggregate count of devices matching specific criteria (OS, compliance, ownership).',
        parameters: z.object({
          os: z.string().optional(),
          compliance: z.string().optional(),
          ownership: z.string().optional()
        }),
        execute: async ({ os, compliance, ownership }, context) => {
          const must: any[] = [];
          if (os) must.push({ term: { 'operatingSystem.keyword': os } });
          if (compliance) must.push({ term: { 'complianceState.keyword': compliance } });
          if (ownership) must.push({ term: { 'deviceOwnership.keyword': ownership } });

          const response = await context.opensearchClient.search({
            index: INDICES.DEVICES,
            body: {
              query: { bool: { must } },
              size: 0,
              track_total_hits: true
            }
          });
          return response.body.hits.total.value;
        }
      },

      search_devices: {
        name: 'search_devices',
        description: 'Filter and search the device inventory by hostname, model, or OS.',
        parameters: z.object({
          query: z.string().optional().describe('Search term'),
          os: z.enum(['Windows', 'macOS', 'iOS', 'Android']).optional(),
          manufacturer: z.string().optional(),
          limit: z.number().optional().default(10)
        }),
        execute: async ({ query, os, manufacturer, limit }, context) => {
          const filter: any[] = [];
          if (os) filter.push({ term: { operatingSystem: os } });
          if (manufacturer) filter.push({ term: { manufacturer } });

          const response = await context.opensearchClient.search({
            index: INDICES.DEVICES,
            body: {
              query: {
                bool: {
                  must: query ? {
                    multi_match: {
                      query,
                      fields: ['deviceName^3', 'model^2', 'serialNumber', 'userPrincipalName']
                    }
                  } : { match_all: {} },
                  filter
                }
              },
              size: limit
            }
          });
          return response.body.hits.hits.map((h: any) => h._source);
        }
      },

      check_compliance_status: {
        name: 'check_compliance_status',
        description: 'Get detailed compliance status for a device, including specific policy failures.',
        parameters: z.object({
          deviceId: z.string().describe('Unique ID of the device')
        }),
        execute: async ({ deviceId }, context) => {
          const response = await context.opensearchClient.get({
            index: INDICES.DEVICES,
            id: deviceId
          });
          const device = response.body._source;
          return {
            isCompliant: device.isCompliant,
            complianceState: device.complianceState,
            policies: device.compliance?.policies || []
          };
        }
      },

      get_threat_status: {
        name: 'get_threat_status',
        description: 'Retrieve active security alerts or threats associated with a device (e.g., malware, suspicious activity).',
        parameters: z.object({
          deviceId: z.string().describe('Unique ID of the device')
        }),
        execute: async ({ deviceId }, context) => {
          const response = await context.opensearchClient.search({
            index: INDICES.ALERTS,
            body: {
              query: { term: { 'deviceId.keyword': deviceId } },
              sort: [{ severity: 'desc' }, { createdDateTime: 'desc' }]
            }
          });
          const alerts = response.body.hits.hits.map((h: any) => h._source);
          const maxSeverity = alerts.length > 0 ? alerts[0].severity : 'Safe';
          return {
            threatLevel: maxSeverity,
            activeAlertCount: alerts.length,
            alerts
          };
        }
      },

      list_non_compliant_devices: {
        name: 'list_non_compliant_devices',
        description: 'Filter devices that are failing compliance policies, optionally by specific failure reason.',
        parameters: z.object({
          reason: z.string().optional().describe('Text to match in policy failure description'),
          os: z.enum(['Windows', 'macOS', 'iOS', 'Android']).optional(),
          limit: z.number().optional().default(20)
        }),
        execute: async ({ reason, os, limit }, context) => {
          const must: any[] = [
            { term: { 'isCompliant': false } }
          ];

          if (os) must.push({ term: { 'operatingSystem': os } });
          
          if (reason) {
            must.push({ 
              nested: {
                path: 'compliance.policies',
                query: {
                  match: { 'compliance.policies.name': reason }
                }
              }
            });
          }

          const response = await context.opensearchClient.search({
            index: INDICES.DEVICES,
            body: {
              query: { bool: { must } },
              size: limit
            }
          });
          return response.body.hits.hits.map((h: any) => h._source);
        }
      },

      get_user_devices: {
        name: 'get_user_devices',
        description: 'Find all devices currently assigned to or registered by a specific user.',
        parameters: z.object({
          upn: z.string().describe('User email/UPN')
        }),
        execute: async ({ upn }, context) => {
          const response = await context.opensearchClient.search({
            index: INDICES.DEVICES,
            body: {
              query: { term: { 'userPrincipalName.keyword': upn } },
              size: 50
            }
          });
          return response.body.hits.hits.map((h: any) => h._source);
        }
      },

      get_device_owner: {
        name: 'get_device_owner',
        description: 'Identify the user who owns or primarily uses a specific device.',
        parameters: z.object({
          deviceId: z.string()
        }),
        execute: async ({ deviceId }, context) => {
          const response = await context.opensearchClient.get({
            index: INDICES.DEVICES,
            id: deviceId
          });
          const upn = response.body._source.userPrincipalName;
          if (!upn) return null;
          return this.getRegistry().get_user_details_deep.execute({ userId: upn }, context);
        }
      },

      get_device_network_info: {
        name: 'get_device_network_info',
        description: 'Retrieve IP addresses and network-related metadata for a device.',
        parameters: z.object({
          deviceId: z.string()
        }),
        execute: async ({ deviceId }, context) => {
          const response = await context.opensearchClient.get({
            index: INDICES.DEVICES,
            id: deviceId
          });
          const d = response.body._source;
          return {
            ipAddress: d.ipAddress,
            ethernetMac: d.ethernetMacAddress,
            wifiMac: d.wiFiMacAddress,
            lastSync: d.lastSyncDateTime
          };
        }
      },

      search_installed_apps: {
        name: 'search_installed_apps',
        description: 'Search for specific software or applications across the entire device fleet.',
        parameters: z.object({
          appName: z.string().describe('Name of the application to find (e.g. Chrome, Zoom)'),
          limit: z.number().optional().default(20)
        }),
        execute: async ({ appName, limit }, context) => {
          // Applications are often stored in a nested 'detectedApps' or similar index/field.
          // Adjusting to our current schema where apps might be in 'detectedApps' index.
          const response = await context.opensearchClient.search({
            index: INDICES.DETECTED_APPS + '*', 
            body: {
              query: { match_phrase: { displayName: appName } },
              size: limit
            }
          });
          return response.body.hits.hits.map((h: any) => h._source);
        }
      },

      // --- SECURITY & BUSINESS TOOLS ---

      search_audit_logs: {
        name: 'search_audit_logs',
        description: 'Search administrative audit logs for specific actions or changes.',
        parameters: z.object({
          query: z.string().describe('Search keyword (e.g. "policy change")'),
          limit: z.number().optional().default(10)
        }),
        execute: async ({ query, limit }, context) => {
          const response = await context.opensearchClient.search({
            index: 'logs-entra-*',
            body: {
              query: {
                bool: {
                  must: [
                    { multi_match: { query, fields: ['message', 'action', 'result_description'] } },
                    { term: { category: 'Audit' } }
                  ]
                }
              },
              sort: [{ timestamp: 'desc' }],
              size: limit
            }
          });
          return response.body.hits.hits.map((h: any) => h._source);
        }
      },

      check_conditional_access_status: {
        name: 'check_conditional_access_status',
        description: 'Analyze which security policies apply to a specific user.',
        parameters: z.object({
          userUpn: z.string()
        }),
        execute: async ({ userUpn }, context) => {
          // Search for policies that might affect this user
          // This queries our local cache of CA policies
          const response = await context.opensearchClient.search({
            index: INDICES.CONDITIONAL_ACCESS_POLICIES,
            body: {
              query: { match_all: {} }, // Simplified: return all active policies for the LLM to filter
              size: 50
            }
          });
          return response.body.hits.hits.map((h: any) => h._source);
        }
      },

      get_license_utilization: {
        name: 'get_license_utilization',
        description: 'Get data on license waste and underutilized subscriptions.',
        parameters: z.object({
          skuPartNumber: z.string().optional().describe('Specific license to check (e.g. SPE_E5)')
        }),
        execute: async ({ skuPartNumber }, context) => {
          const query = skuPartNumber ? { term: { 'skuPartNumber.keyword': skuPartNumber } } : { match_all: {} };
          const response = await context.opensearchClient.search({
            index: INDICES.LICENSES,
            body: { query, size: 20 }
          });
          return response.body.hits.hits.map((h: any) => h._source);
        }
      },

      explain_policy: {
        name: 'explain_policy',
        description: 'Retrieve the detailed settings and configuration values for a specific policy profile.',
        parameters: z.object({
          policyName: z.string().describe('Exact or partial name of the policy profile')
        }),
        execute: async ({ policyName }, context) => {
          const response = await context.opensearchClient.search({
            index: INDICES.CONFIGURATION_PROFILES,
            body: {
              query: {
                multi_match: {
                  query: policyName,
                  fields: ['displayName', 'description'],
                  fuzziness: 'AUTO'
                }
              },
              size: 5
            }
          });
          
          return response.body.hits.hits.map((h: any) => ({
            name: h._source.displayName,
            description: h._source.description,
            settings: h._source.settings || h._source.configurationSettings // Adjust based on schema
          }));
        }
      }
    };
  }
}

export const aiToolsService = new AIToolsService();
