// User Normalizer - Correlates users with their devices, licenses, and analytics
import type { UnifiedUserDocument } from '../schemas/user.schema';
import { LICENSE_SKU_MAP } from '../schemas/user.schema';
import type { UnifiedDeviceDocument } from '../schemas/device.schema';

// Raw data interfaces
interface FetcherOutput {
  users?: any[];
  managedDevices?: any[];
  deviceScores?: any[];
  crashes?: any[];
  [key: string]: any;
}

interface NormalizerOptions {
  includeRawData?: boolean;
  validateRequired?: boolean;
}

export class UserNormalizer {
  private devicesByUser: Map<string, any[]> = new Map();
  private devicesByUpn: Map<string, any[]> = new Map();
  private deviceScoresByName: Map<string, any> = new Map();
  private crashesByDevice: Map<string, any[]> = new Map();
  private normalizedDevices?: UnifiedDeviceDocument[];

  constructor(
    private data: FetcherOutput,
    private options: NormalizerOptions = {},
    normalizedDevices?: UnifiedDeviceDocument[]
  ) {
    this.normalizedDevices = normalizedDevices;
    this.buildLookupMaps();
  }

  /**
   * Build lookup maps for fast correlation
   */
  private buildLookupMaps(): void {
    // Group devices by user ID and UPN
    if (this.data.managedDevices) {
      for (const device of this.data.managedDevices) {
        if (device.userId) {
          const existing = this.devicesByUser.get(device.userId) || [];
          existing.push(device);
          this.devicesByUser.set(device.userId, existing);
        }

        if (device.userPrincipalName) {
          const upn = device.userPrincipalName.toLowerCase();
          const existing = this.devicesByUpn.get(upn) || [];
          existing.push(device);
          this.devicesByUpn.set(upn, existing);
        }
      }
    }

    // Device scores lookup
    if (this.data.deviceScores) {
      for (const score of this.data.deviceScores) {
        if (score.deviceName) {
          this.deviceScoresByName.set(score.deviceName.toLowerCase(), score);
        }
      }
    }

    // Crashes lookup
    if (this.data.crashes) {
      for (const crash of this.data.crashes) {
        const key = crash.deviceId || crash.deviceName;
        if (key) {
          const existing = this.crashesByDevice.get(key) || [];
          existing.push(crash);
          this.crashesByDevice.set(key, existing);
        }
      }
    }
  }

  /**
   * Normalize all users to UnifiedUserDocument format
   */
  public normalizeAll(): UnifiedUserDocument[] {
    if (!this.data.users || this.data.users.length === 0) {
      return [];
    }

    return this.data.users.map(user => this.normalizeUser(user));
  }

  /**
   * Normalize a single user with all correlations
   */
  private normalizeUser(user: any): UnifiedUserDocument {
    const userId = user.id;
    const upn = user.userPrincipalName?.toLowerCase();

    // Get user's devices
    const userDevices = [
      ...(this.devicesByUser.get(userId) || []),
      ...(upn ? (this.devicesByUpn.get(upn) || []) : [])
    ];

    // Deduplicate devices by ID
    const uniqueDevices = Array.from(
      new Map(userDevices.map(d => [d.id, d])).values()
    );

    const doc: UnifiedUserDocument = {
      // Core identity
      id: userId,
      userPrincipalName: user.userPrincipalName,
      displayName: user.displayName,
      givenName: user.givenName,
      surname: user.surname,
      mail: user.mail,

      // Employment info
      employment: this.normalizeEmployment(user),

      // Contact info
      contact: this.normalizeContact(user),

      // Account status
      account: this.normalizeAccount(user),

      // Licenses
      licenses: this.normalizeLicenses(user),

      // Device association
      devices: this.normalizeDevices(uniqueDevices),

      // Aggregated analytics from devices
      analytics: this.normalizeAnalytics(uniqueDevices),

      // Sign-in activity
      signInActivity: this.normalizeSignInActivity(user),

      // Data quality indicators
      dataQuality: {
        hasLicenses: !!(user.assignedLicenses && user.assignedLicenses.length > 0),
        hasDevices: uniqueDevices.length > 0,
        hasAnalytics: uniqueDevices.some(d =>
          this.deviceScoresByName.has(d.deviceName?.toLowerCase())
        ),
        hasSignInActivity: !!(user.signInActivity?.lastSignInDateTime),
        lastEnrichedAt: new Date().toISOString()
      },

      // Ingestion metadata
      ingestion: {
        timestamp: new Date().toISOString(),
        source: 'typescript-fetcher',
        version: '2.0.0'
      }
    };

    return doc;
  }

  /**
   * Normalize employment information
   */
  private normalizeEmployment(user: any): UnifiedUserDocument['employment'] {
    const sanitizedDept = user.department || undefined;

    if (!user.jobTitle && !sanitizedDept && !user.employeeId) {
      return undefined;
    }

    return {
      jobTitle: user.jobTitle,
      department: sanitizedDept,
      officeLocation: user.officeLocation,
      employeeId: user.employeeId,
      employeeType: user.employeeType,
      companyName: user.companyName,
      hireDate: user.employeeHireDate,
      leaveDate: user.employeeLeaveDateTime
    };
  }

  /**
   * Normalize contact information
   */
  private normalizeContact(user: any): UnifiedUserDocument['contact'] {
    if (!user.mobilePhone && !user.businessPhones?.length && !user.otherMails?.length) {
      return undefined;
    }

    return {
      mobilePhone: user.mobilePhone,
      businessPhones: user.businessPhones,
      otherEmails: user.otherMails
    };
  }

  /**
   * Normalize account information
   */
  private normalizeAccount(user: any): UnifiedUserDocument['account'] {
    return {
      enabled: user.accountEnabled !== false,
      userType: user.userType,
      createdDateTime: user.createdDateTime,
      usageLocation: user.usageLocation,
      onPremisesSyncEnabled: user.onPremisesSyncEnabled,
      securityIdentifier: user.securityIdentifier
    };
  }

  /**
   * Normalize license information
   */
  private normalizeLicenses(user: any): UnifiedUserDocument['licenses'] {
    if (!user.assignedLicenses || user.assignedLicenses.length === 0) {
      return undefined;
    }

    const assigned = user.assignedLicenses.map((license: any) => ({
      skuId: license.skuId,
      skuPartNumber: LICENSE_SKU_MAP[license.skuPartNumber] || license.skuPartNumber,
      servicePlans: user.assignedPlans?.filter((plan: any) =>
        plan.servicePlanId // Plans associated with this SKU
      ).map((plan: any) => ({
        servicePlanId: plan.servicePlanId,
        servicePlanName: plan.service,
        provisioningStatus: plan.capabilityStatus
      }))
    }));

    // Count active services
    const activeServices = user.assignedPlans?.filter((plan: any) =>
      plan.capabilityStatus === 'Enabled'
    ).length || 0;

    // Check for key licenses
    const skuParts = user.assignedLicenses.map((l: any) => l.skuPartNumber || '');
    const hasIntuneEMS = skuParts.some((s: string) =>
      s.includes('INTUNE') || s.includes('EMS')
    );
    const hasM365 = skuParts.some((s: string) =>
      s.includes('SPE_') || s.includes('M365')
    );
    const hasAADP = skuParts.some((s: string) =>
      s.includes('AAD_PREMIUM')
    );

    return {
      assigned,
      summary: {
        totalLicenses: assigned.length,
        activeServices,
        hasIntuneEMS,
        hasM365,
        hasAADP
      }
    };
  }

  /**
   * Normalize device association
   */
  private normalizeDevices(devices: any[]): UnifiedUserDocument['devices'] {
    if (devices.length === 0) {
      return undefined;
    }

    const managed = devices.map(device => ({
      deviceId: device.id,
      deviceName: device.deviceName,
      model: device.model,
      operatingSystem: device.operatingSystem,
      complianceState: device.complianceState,
      lastSync: device.lastSyncDateTime
    }));

    // Calculate summary
    const compliantDevices = devices.filter(d =>
      d.complianceState === 'compliant'
    ).length;

    const nonCompliantDevices = devices.filter(d =>
      d.complianceState === 'noncompliant'
    ).length;

    // Platform distribution
    const platforms: Record<string, number> = {};
    for (const device of devices) {
      const os = device.operatingSystem || 'Unknown';
      platforms[os] = (platforms[os] || 0) + 1;
    }

    return {
      managed,
      summary: {
        totalDevices: devices.length,
        compliantDevices,
        nonCompliantDevices,
        platforms
      }
    };
  }

  /**
   * Normalize aggregated analytics from user's devices
   */
  private normalizeAnalytics(devices: any[]): UnifiedUserDocument['analytics'] {
    if (devices.length === 0) {
      return undefined;
    }

    // Calculate overall analytics
    const scores: number[] = [];
    let bestDevice: string | undefined;
    let worstDevice: string | undefined;
    let bestScore = -1;
    let worstScore = 101;

    let totalBootTime = 0;
    let totalLoginTime = 0;
    let bootTimeCount = 0;
    let loginTimeCount = 0;

    let totalCrashes = 0;
    let crashesLast7Days = 0;
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    let devicesWithDefenderIssues = 0;
    let devicesWithoutBitLocker = 0;
    let devicesWithPendingUpdates = 0;

    for (const device of devices) {
      const deviceName = device.deviceName?.toLowerCase();
      if (!deviceName) continue;

      // Get device score
      const score = this.deviceScoresByName.get(deviceName);
      if (score?.endpointAnalyticsScore != null) {
        const scoreVal = score.endpointAnalyticsScore;
        scores.push(scoreVal);

        if (scoreVal > bestScore) {
          bestScore = scoreVal;
          bestDevice = device.deviceName;
        }
        if (scoreVal < worstScore) {
          worstScore = scoreVal;
          worstDevice = device.deviceName;
        }

        // Startup times
        if (score.coreBootTimeInMs != null) {
          totalBootTime += score.coreBootTimeInMs;
          bootTimeCount++;
        }
        if (score.coreLoginTimeInMs != null) {
          totalLoginTime += score.coreLoginTimeInMs;
          loginTimeCount++;
        }
      }

      // Count crashes
      const crashes = this.crashesByDevice.get(device.id) ||
                     this.crashesByDevice.get(deviceName) ||
                     [];
      totalCrashes += crashes.length;
      crashesLast7Days += crashes.filter((c: any) =>
        new Date(c.eventDateTime) >= sevenDaysAgo
      ).length;

      // Security issues (from normalized devices if available)
      if (this.normalizedDevices) {
        const normalizedDevice = this.normalizedDevices.find(nd => nd.id === device.id);
        if (normalizedDevice?.security) {
          if (normalizedDevice.security.protection?.realTimeProtectionEnabled === false ||
              normalizedDevice.security.protection?.signatureUpdateOverdue) {
            devicesWithDefenderIssues++;
          }
          if (normalizedDevice.security.healthAttestation?.bitLockerStatus !== 'enabled') {
            devicesWithoutBitLocker++;
          }
          if ((normalizedDevice.security.protection?.pendingUpdates || 0) > 0) {
            devicesWithPendingUpdates++;
          }
        }
      }
    }

    const averageScore = scores.length > 0 ?
      scores.reduce((a, b) => a + b, 0) / scores.length : undefined;

    const needsAttention = (averageScore != null && averageScore < 70) ||
                          totalCrashes > 10 ||
                          crashesLast7Days > 5 ||
                          devicesWithDefenderIssues > 0 ||
                          devicesWithPendingUpdates > 0;

    return {
      overall: {
        averageScore,
        bestDevice,
        worstDevice,
        needsAttention
      },

      startup: bootTimeCount > 0 ? {
        averageBootTimeMs: Math.round(totalBootTime / bootTimeCount),
        averageLoginTimeMs: loginTimeCount > 0 ?
          Math.round(totalLoginTime / loginTimeCount) : undefined
      } : undefined,

      reliability: {
        totalCrashes,
        totalHangs: 0, // Would need hang data from UXA
        affectedDevices: this.crashesByDevice.size,
        crashesLast7Days
      },

      security: {
        devicesWithDefenderIssues,
        devicesWithoutBitLocker,
        devicesWithPendingUpdates
      }
    };
  }

  /**
   * Normalize sign-in activity
   */
  private normalizeSignInActivity(user: any): UnifiedUserDocument['signInActivity'] {
    if (!user.signInActivity) {
      return undefined;
    }

    return {
      lastSignInDateTime: user.signInActivity.lastSignInDateTime,
      lastNonInteractiveSignInDateTime: user.signInActivity.lastNonInteractiveSignInDateTime,
      lastSuccessfulSignIn: user.signInActivity.lastSuccessfulSignInDateTime,
      recentApplications: user.signInActivity.recentApplications?.map((app: any) => ({
        appDisplayName: app.appDisplayName,
        appId: app.appId,
        signInDateTime: app.createdDateTime || app.signInDateTime, // Handle distinct naming if any
        resourceDisplayName: app.resourceDisplayName
      }))
    };
  }
}

/**
 * Convenience function to normalize users
 */
export function normalizeUsers(
  fetcherOutput: FetcherOutput,
  options?: NormalizerOptions,
  normalizedDevices?: UnifiedDeviceDocument[]
): UnifiedUserDocument[] {
  const normalizer = new UserNormalizer(fetcherOutput, options, normalizedDevices);
  return normalizer.normalizeAll();
}
