import { describe, it, expect, mock } from "bun:test";
import { DeviceNormalizer } from "../../normalizers/device-normalizer"; // Adjust path as needed
import { UnifiedDeviceDocument } from "../../schemas/device.schema"; // Adjust path as needed

// Mock the compliance.repository module to intercept createComplianceReference
mock.module('../../repositories/compliance.repository', () => ({
  createComplianceReference: mock((policyId, displayName, version, state) => ({
    policy_id: policyId,
    display_name: displayName,
    version: version,
    state: state,
    deployment_status: state,
    error_count: 0,
    total_settings: 0,
    last_evaluated: new Date().toISOString()
  })),
}));

// Mock the configuration.repository module to intercept createConfigurationReference
mock.module('../../repositories/configuration.repository', () => ({
  createConfigurationReference: mock((configId, displayName, version, state) => ({
    config_id: configId,
    display_name_cached: displayName,
    version: version,
    deployment_status: state === "compliant" ? "success" : state,
    result_code: undefined,
    last_evaluated: new Date().toISOString()
  })),
  normalizePlatform: (p: any) => "windows",
  extractDeploymentStatus: (s: any) => s === "compliant" ? "success" : s
}));

// Now import after mocking
import * as complianceRepoModule from '../../repositories/compliance.repository';
import * as configRepoModule from '../../repositories/configuration.repository';


// Mock dependencies
const mockOpenSearchClient = {}; // No methods needed for basic normalizer tests
const mockConfigRepo = {
  bulkUpsertProfiles: mock(() => Promise.resolve(new Map())),
  upsertProfile: mock(() => Promise.resolve({ version: 1 }))
};
const mockComplianceRepo = {
  bulkUpsertPolicies: mock(() => Promise.resolve(new Map())),
  bulkUpsertEvaluations: mock(() => Promise.resolve()),
  upsertPolicy: mock(() => Promise.resolve({ version: 1 }))
};


describe("DeviceNormalizer", () => {
  it("should normalize a basic device object correctly", async () => {
    const rawDevice = {
      id: "device-123",
      deviceName: "TestDevice",
      manufacturer: "Microsoft",
      model: "Surface Pro",
      operatingSystem: "Windows",
      osVersion: "10.0.19045.3693",
      userPrincipalName: "testuser@example.com",
      userDisplayName: "Test User",
      complianceState: "compliant",
      isEncrypted: true,
      totalStorageSpaceInBytes: 512000000000,
      physicalMemoryInBytes: 16000000000,
      lastSyncDateTime: "2025-12-13T10:00:00Z",
      enrolledDateTime: "2025-01-01T00:00:00Z",
      serialNumber: "SN-BASIC", // Added serialNumber
    };

    const fetcherOutput = {
      managedDevices: [rawDevice],
      users: [{ id: "user-1", userPrincipalName: "testuser@example.com", displayName: "Test User" }],
      compliancePolicies: [{ id: "policy-abc", displayName: "Test Policy" }],
      configurationPolicies: [{ id: "config-def", displayName: "Test Config Policy", "@odata.type": "#microsoft.graph.windows10CustomConfiguration" }], // Added @odata.type
      deviceComplianceStatus: {
        "device-123": [{
          policyId: "policy-abc",
          state: "compliant",
          lastReportedDateTime: "2025-12-13T10:00:00Z"
        }]
      },
      deviceConfigurationStatus: {
        "device-123": [{
          configId: "config-def",
          state: "compliant",
          lastReportedDateTime: "2025-12-13T10:00:00Z"
        }]
      }
    };

    const normalizer = new DeviceNormalizer(fetcherOutput, {
      opensearchClient: mockOpenSearchClient as any,
      enableDualWrite: true // Test dual write path
    });

    // Manually inject mocks for repositories
    // @ts-ignore - Private members for testing purposes
    normalizer['configRepo'] = mockConfigRepo as any;
    // @ts-ignore - Private members for testing purposes
    normalizer['complianceRepo'] = mockComplianceRepo as any;

    const normalizedDevices = await normalizer.normalizeAll();
    expect(normalizedDevices).toHaveLength(1);

    const device: UnifiedDeviceDocument = normalizedDevices[0];

    // Assert core fields
    expect(device.id).toBe("device-123");
    expect(device.deviceName).toBe("TestDevice");
    expect(device.manufacturer).toBe("Microsoft");
    expect(device.operatingSystem).toBe("Windows");
    expect(device.isCompliant).toBe(true);
    expect(device.complianceState).toBe("compliant");
    expect(device.isEncrypted).toBe(true);
    expect(device.userPrincipalName).toBe("testuser@example.com");
    expect(device.userDisplayName).toBe("Test User");

    // Assert hardware details
    expect(device.hardware?.totalStorageSpaceInBytes).toBe(512000000000);
    expect(device.hardware?.physicalMemoryInBytes).toBe(16000000000);

    // Assert user correlation
    expect(device.user?.id).toBe("user-1");
    expect(device.user?.upn).toBe("testuser@example.com");

    // Assert compliance details (using dual-write path which creates references)
    expect(device.compliance?.state).toBe("compliant");
    expect(device.compliance?.references).toHaveLength(1);
    expect(device.compliance?.references?.[0].policy_id).toBe("policy-abc");
    expect(device.compliance?.references?.[0].deployment_status).toBe("compliant");

    // Assert configuration details (using dual-write path which creates references)
    expect(device.configuration?.references).toHaveLength(1);
    expect(device.configuration?.references?.[0].config_id).toBe("config-def");
    expect(device.configuration?.references?.[0].deployment_status).toBe("success");


    // Verify mocks were called (for dual-write path)
    expect(mockConfigRepo.bulkUpsertProfiles).toHaveBeenCalledTimes(1);
    expect(mockComplianceRepo.bulkUpsertPolicies).toHaveBeenCalledTimes(1);
    expect(mockComplianceRepo.bulkUpsertEvaluations).toHaveBeenCalledTimes(1);
  });

  it("should set isCompliant to false if any policy is noncompliant", async () => {
    const rawDevice = {
      id: "device-noncompliant",
      deviceName: "NonCompliantDevice",
      serialNumber: "SN_NONCOMPLIANT", // Added serialNumber
      complianceState: "compliant", // Raw Intune API state might be compliant, but policy says non-compliant
      // other fields...
    };

    const fetcherOutput = {
      managedDevices: [rawDevice],
      compliancePolicies: [{ id: "policy-noncompliant", displayName: "Non-Compliant Test Policy" }],
      deviceComplianceStatus: {
        "device-noncompliant": [{
          policyId: "policy-noncompliant",
          state: "noncompliant",
          lastReportedDateTime: "2025-12-13T10:00:00Z"
        }]
      }
    };

    const normalizer = new DeviceNormalizer(fetcherOutput, {
      opensearchClient: mockOpenSearchClient as any,
      enableDualWrite: true
    });
    // @ts-ignore
    normalizer['complianceRepo'] = mockComplianceRepo as any;

    const normalizedDevices = await normalizer.normalizeAll();
    const device = normalizedDevices[0];

    expect(device.id).toBe("device-noncompliant");
    expect(device.isCompliant).toBe(false);
    expect(device.compliance?.state).toBe("noncompliant");
  });

  it("should handle devices with no compliance status gracefully", async () => {
    const rawDevice = {
      id: "device-no-compliance",
      deviceName: "NoComplianceDevice",
      serialNumber: "SN_NOCOMPLIANCE", // Added serialNumber
      complianceState: "unknown",
      // No managedDevices, users, compliancePolicies to simulate empty fetcher output for these
    };

    const fetcherOutput = {
      managedDevices: [rawDevice],
      users: []
      // No deviceComplianceStatus
    };

    const normalizer = new DeviceNormalizer(fetcherOutput, {
      opensearchClient: mockOpenSearchClient as any,
      enableDualWrite: true
    });
    // @ts-ignore
    normalizer['complianceRepo'] = mockComplianceRepo as any;

    const normalizedDevices = await normalizer.normalizeAll();
    const device = normalizedDevices[0];

    expect(device.id).toBe("device-no-compliance");
    expect(device.isCompliant).toBe(false); // Default to false if no compliance info
    expect(device.compliance).toBeUndefined();
  });

  it("should map warranty data when serial number is present", async () => {
    const rawDevice = {
      id: "device-warranty",
      deviceName: "WarrantyDevice",
      serialNumber: "SN12345",
      // No managedDevices, users, compliancePolicies to simulate empty fetcher output for these
    };

    const fetcherOutput = {
      managedDevices: [rawDevice],
      warranty: [{ serialNumber: "SN12345", warrantyEnd: "2026-12-01T00:00:00Z", product: "Lenovo" }]
    };

    const normalizer = new DeviceNormalizer(fetcherOutput);
    const normalizedDevices = await normalizer.normalizeAll();
    const device = normalizedDevices[0];

    expect(device.warranty).toBeDefined();
    expect(device.warranty?.status).toBe("active"); // Assuming current date is before 2026-12-01
    expect(device.warranty?.vendor).toBe("Lenovo");
    expect(device.warranty?.inWarranty).toBe(true);
  });
});