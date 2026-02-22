/**
 * Policy Sync Tests - TDD
 * 
 * Tests for policy sync functions in policySync.ts
 * Issue #57: Intune Policies & Conditional Access Management
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ============================================================================
// Mocks
// ============================================================================

vi.mock('@/lib/db/drizzle', () => ({
  db: {
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        onConflictDoUpdate: vi.fn(() => Promise.resolve()),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => Promise.resolve()),
    })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve([])),
        orderBy: vi.fn(() => Promise.resolve([])),
      })),
    })),
    query: {
      devices: {
        findFirst: vi.fn(() => Promise.resolve(null)),
      },
    },
  },
}));

vi.mock('@/lib/db/schema', () => ({
  conditional_access_policies: {
    id: 'id',
    displayName: 'display_name',
  },
  named_locations: {
    id: 'id',
    displayName: 'display_name',
  },
  device_compliance_policies: {
    id: 'id',
    displayName: 'display_name',
  },
  device_compliance_policy_states: {
    deviceId: 'device_id',
    policyId: 'policy_id',
  },
  device_configuration_profiles: {
    id: 'id',
    displayName: 'display_name',
  },
  device_configuration_profile_states: {
    deviceId: 'device_id',
    profileId: 'profile_id',
  },
  device_conditional_access: {},
  devices: {
    id: 'id',
    azureId: 'azure_id',
  },
}));

vi.mock('@/lib/graph/client', () => ({
  getConditionalAccessPolicies: vi.fn(() => Promise.resolve([])),
  getNamedLocations: vi.fn(() => Promise.resolve([])),
  getDeviceCompliancePoliciesList: vi.fn(() => Promise.resolve([])),
  getDeviceConfigurations: vi.fn(() => Promise.resolve([])),
  getConfigurationPolicies: vi.fn(() => Promise.resolve([])),
  getDeviceCompliancePolicies: vi.fn(() => Promise.resolve([])),
  getDeviceConfigurationProfiles: vi.fn(() => Promise.resolve([])),
}));

// ============================================================================
// Import after mocks
// ============================================================================

import { 
  upsertConditionalAccessPolicy, 
  upsertNamedLocation,
  upsertDeviceCompliancePolicy,
  upsertDeviceConfigurationProfile,
  syncConditionalAccessPolicies,
  syncNamedLocations,
  syncDeviceCompliancePolicies,
  syncDeviceConfigurationProfiles,
  syncAllPolicies,
  detectPlatformType,
  detectLocationType,
  detectPolicyState,
} from '@/lib/services/policySync';

import { db } from '@/lib/db/drizzle';
import * as graphClient from '@/lib/graph/client';

// ============================================================================
// Test Suite
// ============================================================================

describe('Policy Sync Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('detectPlatformType', () => {
    it('should detect android platform', () => {
      expect(detectPlatformType('#microsoft.graph.androidCompliancePolicy')).toBe('android');
      expect(detectPlatformType('android')).toBe('android');
    });

    it('should detect iOS platform', () => {
      expect(detectPlatformType('#microsoft.graph.iosCompliancePolicy')).toBe('iOS');
      expect(detectPlatformType('iOS')).toBe('iOS');
      expect(detectPlatformType('iPadOS')).toBe('iOS');
    });

    it('should detect Windows platform', () => {
      expect(detectPlatformType('#microsoft.graph.windows10CompliancePolicy')).toBe('windows');
      expect(detectPlatformType('windows')).toBe('windows');
    });

    it('should detect macOS platform', () => {
      expect(detectPlatformType('#microsoft.graph.macOSCompliancePolicy')).toBe('macOS');
      expect(detectPlatformType('macOS')).toBe('macOS');
    });

    it('should detect Linux platform', () => {
      expect(detectPlatformType('#microsoft.graph.linuxCompliancePolicy')).toBe('linux');
    });

    it('should return unknown for unrecognized platform', () => {
      expect(detectPlatformType('unknown')).toBe('unknown');
      expect(detectPlatformType(undefined)).toBe('unknown');
      expect(detectPlatformType('')).toBe('unknown');
    });
  });

  describe('detectLocationType', () => {
    it('should detect IP named location', () => {
      expect(detectLocationType('#microsoft.graph.ipNamedLocation')).toBe('ip');
      expect(detectLocationType('ipNamedLocation')).toBe('ip');
    });

    it('should detect country named location', () => {
      expect(detectLocationType('#microsoft.graph.countryNamedLocation')).toBe('country');
      expect(detectLocationType('countryNamedLocation')).toBe('country');
    });

    it('should default to IP for unknown types', () => {
      expect(detectLocationType(undefined)).toBe('ip');
      expect(detectLocationType('')).toBe('ip');
    });
  });

  describe('detectPolicyState', () => {
    it('should detect enabled state', () => {
      expect(detectPolicyState('enabled')).toBe('enabled');
    });

    it('should detect disabled state', () => {
      expect(detectPolicyState('disabled')).toBe('disabled');
    });

    it('should detect report-only state', () => {
      expect(detectPolicyState('enabledForReportingButNotEnforced')).toBe('enabledForReportingButNotEnforced');
    });

    it('should default to disabled for unknown states', () => {
      expect(detectPolicyState(undefined)).toBe('disabled');
      expect(detectPolicyState('')).toBe('disabled');
      expect(detectPolicyState('invalid')).toBe('disabled');
    });
  });

  describe('upsertConditionalAccessPolicy', () => {
    it('should insert a new conditional access policy', async () => {
      const mockPolicy = {
        id: 'ca-policy-1',
        displayName: 'Require MFA',
        description: 'Require multi-factor authentication',
        state: 'enabled',
        createdDateTime: '2024-01-01T00:00:00Z',
        modifiedDateTime: '2024-01-15T00:00:00Z',
        conditions: { signInRiskLevels: ['high'] },
        grantControls: { operator: 'OR', controls: ['mfa'] },
        sessionControls: null,
      };

      await upsertConditionalAccessPolicy(mockPolicy);

      expect(db.insert).toHaveBeenCalled();
    });

    it('should handle minimal policy data', async () => {
      const mockPolicy = {
        id: 'ca-policy-2',
      };

      await upsertConditionalAccessPolicy(mockPolicy);

      expect(db.insert).toHaveBeenCalled();
    });
  });

  describe('upsertNamedLocation', () => {
    it('should insert a new IP named location', async () => {
      const mockLocation = {
        id: 'location-1',
        displayName: 'Corporate HQ',
        '@odata.type': '#microsoft.graph.ipNamedLocation',
        isTrusted: true,
        ipRanges: [
          { '@odata.type': '#microsoft.graph.ipV4CidrRange', cidrAddress: '10.0.0.0/8' },
        ],
        createdDateTime: '2024-01-01T00:00:00Z',
        modifiedDateTime: '2024-01-15T00:00:00Z',
      };

      await upsertNamedLocation(mockLocation);

      expect(db.insert).toHaveBeenCalled();
    });

    it('should insert a new country named location', async () => {
      const mockLocation = {
        id: 'location-2',
        displayName: 'Allowed Countries',
        '@odata.type': '#microsoft.graph.countryNamedLocation',
        isTrusted: false,
        countriesAndRegions: ['US', 'CA', 'GB'],
        includeUnknownCountriesAndRegions: false,
      };

      await upsertNamedLocation(mockLocation);

      expect(db.insert).toHaveBeenCalled();
    });

    it('should filter out invalid IP ranges', async () => {
      const mockLocation = {
        id: 'location-3',
        displayName: 'Mixed Location',
        '@odata.type': '#microsoft.graph.ipNamedLocation',
        ipRanges: [
          { cidrAddress: '10.0.0.0/8' },
          {}, // Invalid - no cidrAddress
          { cidrAddress: undefined }, // Invalid - undefined cidrAddress
        ],
      };

      await upsertNamedLocation(mockLocation);

      expect(db.insert).toHaveBeenCalled();
    });
  });

  describe('upsertDeviceCompliancePolicy', () => {
    it('should insert a new compliance policy', async () => {
      const mockPolicy = {
        id: 'compliance-1',
        displayName: 'Windows 10 Compliance',
        description: 'Minimum Windows 10 requirements',
        '@odata.type': '#microsoft.graph.windows10CompliancePolicy',
        version: 1,
        createdDateTime: '2024-01-01T00:00:00Z',
        modifiedDateTime: '2024-01-15T00:00:00Z',
      };

      await upsertDeviceCompliancePolicy(mockPolicy);

      expect(db.insert).toHaveBeenCalled();
    });
  });

  describe('upsertDeviceConfigurationProfile', () => {
    it('should insert a new configuration profile', async () => {
      const mockProfile = {
        id: 'config-1',
        displayName: 'Device Restrictions',
        description: 'Configure device restrictions',
        '@odata.type': '#microsoft.graph.deviceConfiguration',
        profileType: 'microsoft.graph.deviceConfiguration',
        version: 2,
        createdDateTime: '2024-01-01T00:00:00Z',
        modifiedDateTime: '2024-01-15T00:00:00Z',
      };

      await upsertDeviceConfigurationProfile(mockProfile);

      expect(db.insert).toHaveBeenCalled();
    });
  });

  describe('syncConditionalAccessPolicies', () => {
    it('should fetch and sync all CA policies', async () => {
      const mockPolicies = [
        { id: 'ca-1', displayName: 'Policy 1', state: 'enabled' },
        { id: 'ca-2', displayName: 'Policy 2', state: 'disabled' },
      ];

      (graphClient.getConditionalAccessPolicies as any).mockResolvedValue(mockPolicies);

      const result = await syncConditionalAccessPolicies();

      expect(result).toBe(2);
      expect(graphClient.getConditionalAccessPolicies).toHaveBeenCalled();
    });

    it('should return 0 when no policies exist', async () => {
      (graphClient.getConditionalAccessPolicies as any).mockResolvedValue([]);

      const result = await syncConditionalAccessPolicies();

      expect(result).toBe(0);
    });
  });

  describe('syncNamedLocations', () => {
    it('should fetch and sync all named locations', async () => {
      const mockLocations = [
        { id: 'loc-1', displayName: 'Office', '@odata.type': '#microsoft.graph.ipNamedLocation' },
        { id: 'loc-2', displayName: 'Allowed', '@odata.type': '#microsoft.graph.countryNamedLocation' },
      ];

      (graphClient.getNamedLocations as any).mockResolvedValue(mockLocations);

      const result = await syncNamedLocations();

      expect(result).toBe(2);
    });
  });

  describe('syncDeviceCompliancePolicies', () => {
    it('should fetch and sync all compliance policies', async () => {
      const mockPolicies = [
        { id: 'comp-1', displayName: 'Windows Compliance', '@odata.type': '#microsoft.graph.windows10CompliancePolicy' },
        { id: 'comp-2', displayName: 'iOS Compliance', '@odata.type': '#microsoft.graph.iosCompliancePolicy' },
      ];

      (graphClient.getDeviceCompliancePoliciesList as any).mockResolvedValue(mockPolicies);

      const result = await syncDeviceCompliancePolicies();

      expect(result).toBe(2);
    });
  });

  describe('syncDeviceConfigurationProfiles', () => {
    it('should fetch and sync from both configs and configPolicies endpoints', async () => {
      const mockConfigs = [
        { id: 'config-1', displayName: 'Config 1', '@odata.type': '#microsoft.graph.deviceConfiguration' },
      ];
      const mockConfigPolicies = [
        { id: 'policy-1', displayName: 'Policy 1', '@odata.type': '#microsoft.graph.deviceConfiguration' },
      ];

      (graphClient.getDeviceConfigurations as any).mockResolvedValue(mockConfigs);
      (graphClient.getConfigurationPolicies as any).mockResolvedValue(mockConfigPolicies);

      const result = await syncDeviceConfigurationProfiles();

      expect(result).toBe(2);
    });
  });

  describe('syncAllPolicies', () => {
    it('should sync all policy types', async () => {
      (graphClient.getConditionalAccessPolicies as any).mockResolvedValue([
        { id: 'ca-1', displayName: 'CA', state: 'enabled' },
      ]);
      (graphClient.getNamedLocations as any).mockResolvedValue([
        { id: 'loc-1', displayName: 'Loc', '@odata.type': '#microsoft.graph.ipNamedLocation' },
      ]);
      (graphClient.getDeviceCompliancePoliciesList as any).mockResolvedValue([
        { id: 'comp-1', displayName: 'Comp', '@odata.type': '#microsoft.graph.windows10CompliancePolicy' },
      ]);
      (graphClient.getDeviceConfigurations as any).mockResolvedValue([]);
      (graphClient.getConfigurationPolicies as any).mockResolvedValue([]);

      const result = await syncAllPolicies();

      expect(result.conditionalAccess).toBe(1);
      expect(result.namedLocations).toBe(1);
      expect(result.compliancePolicies).toBe(1);
      expect(result.configurationProfiles).toBe(0);
      expect(result.totalPolicies).toBe(3);
    });
  });
});
