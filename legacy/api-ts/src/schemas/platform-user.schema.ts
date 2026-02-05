/**
 * Platform User Schema
 * 
 * Defines the schema for users who have login access to the platform.
 * Supports both Local and SSO users.
 */

export const platformUserMapping = {
  properties: {
    id: { type: 'keyword' },
    email: { type: 'keyword' },
    displayName: { type: 'text' },
    upn: { type: 'keyword' },
    tenantId: { type: 'keyword' },
    source: { type: 'keyword' }, // 'local' or 'sso'
    role: { type: 'keyword' },   // 'admin', 'viewer', 'analyst'
    isActive: { type: 'boolean' },
    lastLogin: { type: 'date' },
    createdAt: { type: 'date' },
    updatedAt: { type: 'date' }
  }
};
