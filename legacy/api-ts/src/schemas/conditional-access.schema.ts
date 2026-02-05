// Conditional Access Policy Schema
// Stores global Conditional Access policies from Microsoft Entra ID

/**
 * Conditional Access Policy State
 */
export type ConditionalAccessPolicyState =
  | 'enabled'
  | 'disabled'
  | 'enabledForReportingButNotEnforced';

/**
 * Conditional Access Policy Interface
 * Represents the structure stored in OpenSearch
 */
export interface ConditionalAccessPolicy {
  id: string;                    // Policy ID from Graph
  displayName: string;           // Human-readable name
  state: ConditionalAccessPolicyState; // Policy state
  createdDateTime: string;       // ISO timestamp
  modifiedDateTime: string;      // ISO timestamp
  conditions: any;               // Complex object - stored as-is
  grantControls: any;            // Complex object - stored as-is
  sessionControls: any;          // Complex object - stored as-is
  indexedAt: string;             // Timestamp when ingested
}

/**
 * OpenSearch mapping for conditional_access_policies index
 * Index name: conditional_access_policies
 */
export const conditionalAccessPolicyMapping = {
  properties: {
    id: { type: 'keyword' },
    displayName: { 
      type: 'text',
      fields: {
        keyword: { type: 'keyword', ignore_above: 256 }
      }
    },
    state: { type: 'keyword' },
    createdDateTime: { type: 'date' },
    modifiedDateTime: { type: 'date' },
    
    // Store complex nested objects without indexing every sub-field
    // This prevents mapping explosions while keeping the data available for retrieval
    conditions: { type: 'object', enabled: false },
    grantControls: { type: 'object', enabled: false },
    sessionControls: { type: 'object', enabled: false },
    
    indexedAt: { type: 'date' }
  }
};
