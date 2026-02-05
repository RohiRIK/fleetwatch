// Configuration Profile Schema
// Stores Intune/device configuration profiles with version history

export interface ConfigurationProfile {
  // Core Identity - MUST be keyword for aggregations
  config_id: string;              // Unique ID of the configuration (e.g., "0a1b2c3d-...")
  version: number;                // Version number (1, 2, 3...)
  content_hash: string;           // SHA-256 hash of settings_payload

  // Metadata
  display_name: string;
  description?: string;
  platform: 'windows' | 'macOS' | 'iOS' | 'android' | 'linux';
  created_date: string;           // ISO 8601 timestamp
  last_modified_date: string;     // ISO 8601 timestamp
  is_active_reference: boolean;   // True if this is the latest version

  // Configuration Details
  technology?: string;            // e.g., "mdm", "windows10EndpointProtection"
  profile_type?: string;          // e.g., "settingsCatalog", "custom"

  // Settings Payload
  settings_payload?: any;         // The actual configuration JSON

  // Assignment Information
  assignments?: Array<{
    target_type: 'allUsers' | 'allDevices' | 'group';
    group_id?: string;
    group_name?: string;
  }>;
}

/**
 * OpenSearch mapping for configuration_profiles index
 * CRITICAL: config_id MUST be keyword type for collapse/aggregation operations
 */
export const configurationProfileMapping = {
  properties: {
    // === Core Identity (KEYWORD for aggregations) ===
    config_id: {
      type: 'keyword'  // MUST be keyword, not text!
    },
    version: {
      type: 'integer'
    },
    content_hash: {
      type: 'keyword'
    },

    // === Metadata ===
    display_name: {
      type: 'text',
      fields: {
        keyword: { type: 'keyword' }  // For sorting
      }
    },
    description: {
      type: 'text'
    },
    platform: {
      type: 'keyword'
    },
    created_date: {
      type: 'date'
    },
    last_modified_date: {
      type: 'date'
    },
    is_active_reference: {
      type: 'boolean'
    },

    // === Configuration Details ===
    technology: {
      type: 'keyword'
    },
    profile_type: {
      type: 'keyword'
    },

    // === Settings Payload ===
    settings_payload: {
      type: 'object',
      enabled: true  // Store as-is, don't analyze
    },

    // === Assignments ===
    assignments: {
      type: 'nested',
      properties: {
        target_type: { type: 'keyword' },
        group_id: { type: 'keyword' },
        group_name: {
          type: 'text',
          fields: {
            keyword: { type: 'keyword' }
          }
        }
      }
    }
  }
};
