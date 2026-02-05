/**
 * Integration Schema
 * 
 * Defines the schema for third-party integrations (e.g., SIEM).
 * Stores API keys and metadata.
 */

export const integrationMapping = {
  properties: {
    id: { type: 'keyword' },
    name: { type: 'text' },
    type: { type: 'keyword' }, // 'siem'
    apiKeyHash: { type: 'keyword' }, // Hashed API key
    keyPrefix: { type: 'keyword' }, // First few chars for identification
    isActive: { type: 'boolean' },
    lastUsed: { type: 'date' },
    createdAt: { type: 'date' },
    updatedAt: { type: 'date' },
    createdBy: { type: 'keyword' } // User ID
  }
};
