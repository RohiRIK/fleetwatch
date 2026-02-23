'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowLeft,
  HardDrive,
  Shield,
  Settings,
  Lock,
  Activity,
  Code,
  Loader2,
  CheckCircle2,
  XCircle,
  Calendar,
  User,
  Monitor,
  Cpu,
  Database,
  Wifi,
  RefreshCw,
} from 'lucide-react';

// Phase 3: New device detail cards
import { HardwareDeepDiveCard } from '@/components/device-detail/HardwareDeepDiveCard';
import { ManagementStatusCard } from '@/components/device-detail/ManagementStatusCard';
import { SecurityHardwareCard } from '@/components/device-detail/SecurityHardwareCard';
import { ExchangeActiveSyncCard } from '@/components/device-detail/ExchangeActiveSyncCard';
import { MalwareProtectionCard } from '@/components/device-detail/MalwareProtectionCard';
import { ConfigurationProfilesCard } from '@/components/device-detail/ConfigurationProfilesCard';
import { SecurityCard } from '@/components/device-detail/SecurityCard';

interface Device {
  id: string;
  azureId: string;
  azureAdDeviceId: string | null;
  deviceName: string;
  serialNumber: string | null;
  manufacturer: string | null;
  model: string | null;
  operatingSystem: string | null;
  osVersion: string | null;
  isCompliant: boolean;
  complianceState: string | null;
  isEncrypted: boolean;
  isSupervised: boolean;
  jailBroken: string | null;
  // Phase 2 new fields - compliance & security
  complianceGracePeriodExpiration: string | null;
  partnerReportedThreatState: string | null;
  userPrincipalName: string | null;
  userDisplayName: string | null;
  userEmail: string | null;
  userDepartment: string | null;
  storageTotal: number | null;
  storageFree: number | null;
  memoryTotal: number | null;
  batteryHealth: number | null;
  chassisType: string | null;
  // Phase 2 new fields - mobile devices
  imei: string | null;
  phoneNumber: string | null;
  notes: string | null;
  ipAddressV4: string | null;
  wifiMac: string | null;
  ethernetMac: string | null;
  joinType: string | null;
  enrollmentType: string | null;
  managedDeviceOwnerType: string | null;
  enrolledAt: string | null;
  lastSyncAt: string | null;
  createdAt: string;
  updatedAt: string;
  rawDeviceData: any;
  complianceDetails: any;
  configurationDetails: any;
  securityDetails: any;
  dataQuality: any;
  ingestionMetadata: any;
  
  // Phase 3 new fields - hardware deep dive
  meid: string | null;
  iccid: string | null;
  udid: string | null;
  subscriberCarrier: string | null;
  batterySerialNumber: string | null;
  batteryChargeCycles: number | null;
  batteryLevelPercentage: number | null;
  residentUsersCount: number | null;
  productName: string | null;
  deviceFullQualifiedDomainName: string | null;
  
  // Phase 3 new fields - management
  managementAgent: string | null;
  managementCertificateExpirationDate: string | null;
  managementFeatures: string | null;
  remoteAssistanceSessionUrl: string | null;
  remoteAssistanceSessionErrorDetails: string | null;
  requireUserEnrollmentApproval: boolean | null;
  enrollmentProfileName: string | null;
  
  // Phase 3 new fields - security hardware
  tpmPresent: boolean | null;
  secureBootEnabled: boolean | null;
  codeIntegrityEnabled: boolean | null;
  bootDebuggingEnabled: boolean | null;
  
  // Phase 3 new fields - Exchange ActiveSync
  easActivated: boolean | null;
  easDeviceId: string | null;
  exchangeLastSuccessfulSyncDateTime: string | null;
  
  // Phase 3 new fields - malware
  malwareActiveCount: number | null;
  malwareRemediatedCount: number | null;
}

interface DeviceGroup {
  id: string;
  groupName: string;
  groupType: string;
  description: string | null;
}

interface UserLicense {
  id: string;
  skuName: string | null;
  skuPartNumber: string;
  capabilityStatus: string;
}

interface DeviceAnalytics {
  overallScore: number | null;
  startupScore: number | null;
  appReliabilityScore: number | null;
  batteryScore: number | null;
  healthStatus: string | null;
}

export default function DeviceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = use(params);
  const id = unwrappedParams.id;
  const router = useRouter();
  const [device, setDevice] = useState<Device | null>(null);
  const [deviceGroups, setDeviceGroups] = useState<DeviceGroup[]>([]);
  const [userLicenses, setUserLicenses] = useState<UserLicense[]>([]);
  const [deviceAnalytics, setDeviceAnalytics] = useState<DeviceAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDevice = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/devices/${id}`);
        const data = await response.json();
        if (data.success) {
          setDevice(data.device);
          setDeviceGroups(data.deviceGroups || []);
          setUserLicenses(data.userLicenses || []);
          setDeviceAnalytics(data.deviceAnalytics || null);
        }
      } catch (error) {
        console.error('Failed to load device:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDevice();
  }, [id]);

  const formatBytes = (bytes: number | null) => {
    if (!bytes) return 'N/A';
    const gb = bytes / (1024 ** 3);
    return `${gb.toFixed(2)} GB`;
  };

  if (loading) {
    return (
      <div className="container mx-auto py-10 flex items-center justify-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!device) {
    return (
      <div className="container mx-auto py-10">
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            Device not found
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <HardDrive className="h-6 w-6" />
            <h1 className="text-3xl font-bold">{device.deviceName}</h1>
          </div>
          <p className="text-muted-foreground mt-1">
            {device.manufacturer} {device.model}
          </p>
        </div>
        <div className="flex gap-2">
          <Badge variant={device.isCompliant ? 'default' : 'destructive'}>
            {device.isCompliant ? (
              <CheckCircle2 className="h-3 w-3 mr-1" />
            ) : (
              <XCircle className="h-3 w-3 mr-1" />
            )}
            {device.isCompliant ? 'Compliant' : 'Non-Compliant'}
          </Badge>
          {device.isEncrypted && (
            <Badge variant="secondary">
              <Lock className="h-3 w-3 mr-1" />
              Encrypted
            </Badge>
          )}
        </div>
      </div>

        {/* Tabs */}
        <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
          <TabsTrigger value="configuration">Configuration</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="hardware">Hardware</TabsTrigger>
          <TabsTrigger value="network">Network</TabsTrigger>
          <TabsTrigger value="raw">Raw Data</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Monitor className="h-5 w-5" />
                  Basic Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Operating System</p>
                  <p className="text-sm">{device.operatingSystem} {device.osVersion}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Serial Number</p>
                  <p className="text-sm font-mono">{device.serialNumber || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Chassis Type</p>
                  <p className="text-sm">{device.chassisType || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Azure ID</p>
                  <p className="text-sm font-mono text-xs">{device.azureId}</p>
                </div>
              </CardContent>
            </Card>

            {/* User Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  User Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Display Name</p>
                  <p className="text-sm">{device.userDisplayName || 'Unassigned'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Email</p>
                  <p className="text-sm">{device.userEmail || device.userPrincipalName || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Department</p>
                  <p className="text-sm">{device.userDepartment || 'N/A'}</p>
                </div>
              </CardContent>
            </Card>

            {/* Device Groups */}
            {deviceGroups.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Device Groups
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {deviceGroups.map((group) => (
                      <div key={group.id} className="flex items-center justify-between p-2 rounded bg-muted">
                        <div>
                          <p className="text-sm font-medium">{group.groupName}</p>
                          {group.description && (
                            <p className="text-xs text-muted-foreground">{group.description}</p>
                          )}
                        </div>
                        <Badge variant="outline">{group.groupType}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* User Licenses */}
            {userLicenses.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    User Licenses
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {userLicenses.map((license) => (
                      <div key={license.id} className="flex items-center justify-between p-2 rounded bg-muted">
                        <div>
                          <p className="text-sm font-medium">{license.skuName || license.skuPartNumber}</p>
                        </div>
                        <Badge variant={license.capabilityStatus === 'Enabled' ? 'default' : 'secondary'}>
                          {license.capabilityStatus}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Enrollment Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Enrollment
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Join Type</p>
                  <p className="text-sm">{device.joinType || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Enrollment Type</p>
                  <p className="text-sm">{device.enrollmentType || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Owner Type</p>
                  <p className="text-sm">{device.managedDeviceOwnerType || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Enrolled At</p>
                  <p className="text-sm">
                    {device.enrolledAt ? new Date(device.enrolledAt).toLocaleString() : 'N/A'}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Sync Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Sync Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Last Synced</p>
                  <p className="text-sm">
                    {device.lastSyncAt ? new Date(device.lastSyncAt).toLocaleString() : 'Never'}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Created</p>
                  <p className="text-sm">{new Date(device.createdAt).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Updated</p>
                  <p className="text-sm">{new Date(device.updatedAt).toLocaleString()}</p>
                </div>
                <Button size="sm" className="w-full mt-2">
                  <RefreshCw className="h-3 w-3 mr-2" />
                  Sync Now
                </Button>
              </CardContent>
            </Card>

            {/* Phase 2: Admin Notes */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Admin Notes
                </CardTitle>
                <CardDescription>
                  Internal notes and comments (admin only)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <textarea
                  className="w-full min-h-[100px] p-3 border rounded-md text-sm resize-y"
                  placeholder="Add internal notes about this device..."
                  defaultValue={device.notes || ''}
                  onBlur={async (e) => {
                    const newNotes = e.target.value;
                    try {
                      const response = await fetch(`/api/devices/${device.id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ notes: newNotes }),
                      });
                      if (!response.ok) {
                        console.error('Failed to save notes');
                      }
                    } catch (error) {
                      console.error('Error saving notes:', error);
                    }
                  }}
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Notes are automatically saved when you click away
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Compliance Tab */}
        <TabsContent value="compliance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Compliance Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-lg border">
                  <p className="text-sm font-medium text-muted-foreground">Compliance</p>
                  <div className="flex items-center gap-2 mt-2">
                    {device.isCompliant ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500" />
                    )}
                    <p className="font-medium">{device.isCompliant ? 'Compliant' : 'Non-Compliant'}</p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    State: {device.complianceState || 'Unknown'}
                  </p>
                </div>

                <div className="p-4 rounded-lg border">
                  <p className="text-sm font-medium text-muted-foreground">Encryption</p>
                  <div className="flex items-center gap-2 mt-2">
                    {device.isEncrypted ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500" />
                    )}
                    <p className="font-medium">{device.isEncrypted ? 'Encrypted' : 'Not Encrypted'}</p>
                  </div>
                </div>

                <div className="p-4 rounded-lg border">
                  <p className="text-sm font-medium text-muted-foreground">Supervised</p>
                  <div className="flex items-center gap-2 mt-2">
                    {device.isSupervised ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-muted-foreground" />
                    )}
                    <p className="font-medium">{device.isSupervised ? 'Supervised' : 'Not Supervised'}</p>
                  </div>
                </div>

                {/* Phase 2 New Fields */}
                <div className="p-4 rounded-lg border">
                  <p className="text-sm font-medium text-muted-foreground">Grace Period</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Calendar className="h-5 w-5 text-blue-500" />
                    <p className="font-medium text-sm">
                      {device.complianceGracePeriodExpiration 
                        ? new Date(device.complianceGracePeriodExpiration).toLocaleDateString()
                        : 'N/A'}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Compliance grace period
                  </p>
                </div>

                <div className="p-4 rounded-lg border">
                  <p className="text-sm font-medium text-muted-foreground">Threat State</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Shield className="h-5 w-5 text-yellow-500" />
                    <p className="font-medium text-sm capitalize">
                      {device.partnerReportedThreatState || 'Unknown'}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Partner-reported threat detection
                  </p>
                </div>

                {device.jailBroken && (
                  <div className="p-4 rounded-lg border">
                    <p className="text-sm font-medium text-muted-foreground">Jailbroken</p>
                    <div className="flex items-center gap-2 mt-2">
                      {device.jailBroken === 'Unknown' ? (
                        <XCircle className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-500" />
                      )}
                      <p className="font-medium text-sm capitalize">{device.jailBroken}</p>
                    </div>
                  </div>
                )}
              </div>

              {device.complianceDetails && (
                <div className="mt-4">
                  <h3 className="font-medium mb-2">Compliance Policies</h3>
                  <div className="space-y-3">
                    {Array.isArray(device.complianceDetails) && device.complianceDetails.length > 0 ? (
                      device.complianceDetails.map((policy: any, index: number) => (
                        <div key={index} className="p-3 rounded-lg border">
                          <div className="flex items-center justify-between mb-2">
                            <p className="font-medium text-sm">{policy.displayName || 'Policy ' + (index + 1)}</p>
                            <span className={`text-xs px-2 py-1 rounded ${
                              policy.state === 'compliant' ? 'bg-green-100 text-green-800' :
                              policy.state === 'nonCompliant' ? 'bg-red-100 text-red-800' :
                              policy.state === 'error' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {policy.state || 'Unknown'}
                            </span>
                          </div>
                          
                          {/* Show policy settings if available */}
                          {policy.policySettings && (
                            <div className="mt-3 pl-3 border-l-2 border-muted">
                              <p className="text-xs font-medium text-muted-foreground mb-2">Policy Requirements:</p>
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                {policy.policySettings.bitLockerEnabled !== undefined && (
                                  <div className="flex items-center gap-1">
                                    {policy.policySettings.bitLockerEnabled ? (
                                      <CheckCircle2 className="h-3 w-3 text-green-500" />
                                    ) : (
                                      <XCircle className="h-3 w-3 text-muted-foreground" />
                                    )}
                                    <span>BitLocker</span>
                                  </div>
                                )}
                                {policy.policySettings.secureBootEnabled !== undefined && (
                                  <div className="flex items-center gap-1">
                                    {policy.policySettings.secureBootEnabled ? (
                                      <CheckCircle2 className="h-3 w-3 text-green-500" />
                                    ) : (
                                      <XCircle className="h-3 w-3 text-muted-foreground" />
                                    )}
                                    <span>Secure Boot</span>
                                  </div>
                                )}
                                {policy.policySettings.codeIntegrityEnabled !== undefined && (
                                  <div className="flex items-center gap-1">
                                    {policy.policySettings.codeIntegrityEnabled ? (
                                      <CheckCircle2 className="h-3 w-3 text-green-500" />
                                    ) : (
                                      <XCircle className="h-3 w-3 text-muted-foreground" />
                                    )}
                                    <span>Code Integrity</span>
                                  </div>
                                )}
                                {policy.policySettings.osMinimumVersion && (
                                  <div className="flex items-center gap-1">
                                    <span className="text-muted-foreground">Min OS:</span>
                                    <span>{policy.policySettings.osMinimumVersion}</span>
                                  </div>
                                )}
                                {policy.policySettings.osMaximumVersion && (
                                  <div className="flex items-center gap-1">
                                    <span className="text-muted-foreground">Max OS:</span>
                                    <span>{policy.policySettings.osMaximumVersion}</span>
                                  </div>
                                )}
                                {policy.policySettings.passwordRequired !== undefined && (
                                  <div className="flex items-center gap-1">
                                    {policy.policySettings.passwordRequired ? (
                                      <CheckCircle2 className="h-3 w-3 text-green-500" />
                                    ) : (
                                      <XCircle className="h-3 w-3 text-muted-foreground" />
                                    )}
                                    <span>Password Required</span>
                                  </div>
                                )}
                                {policy.policySettings.passwordMinimumLength && (
                                  <div className="flex items-center gap-1">
                                    <span className="text-muted-foreground">Min Password:</span>
                                    <span>{policy.policySettings.passwordMinimumLength} chars</span>
                                  </div>
                                )}
                                {policy.policySettings.storageRequireEncryption !== undefined && (
                                  <div className="flex items-center gap-1">
                                    {policy.policySettings.storageRequireEncryption ? (
                                      <CheckCircle2 className="h-3 w-3 text-green-500" />
                                    ) : (
                                      <XCircle className="h-3 w-3 text-muted-foreground" />
                                    )}
                                    <span>Storage Encryption</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                          
                          {policy.settingCount && (
                            <p className="text-xs text-muted-foreground mt-2">
                              {policy.settingCount} settings checked
                            </p>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">No compliance policies found</p>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Configuration Tab */}
        <TabsContent value="configuration" className="space-y-4">
          <ConfigurationProfilesCard 
            profiles={device.configurationDetails} 
          />
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="space-y-4">
          <SecurityCard 
            data={device.securityDetails}
            isEncrypted={device.isEncrypted}
            jailBroken={device.jailBroken}
            tpmPresent={device.tpmPresent}
            secureBootEnabled={device.secureBootEnabled}
            codeIntegrityEnabled={device.codeIntegrityEnabled}
          />
        </TabsContent>

        {/* Hardware Tab */}
        <TabsContent value="hardware" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Storage
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Storage</p>
                  <p className="text-sm">{formatBytes(device.storageTotal)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Free Storage</p>
                  <p className="text-sm">{formatBytes(device.storageFree)}</p>
                </div>
                {device.storageTotal && device.storageFree && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Used Storage</p>
                    <p className="text-sm">
                      {formatBytes(device.storageTotal - device.storageFree)} (
                      {Math.round(((device.storageTotal - device.storageFree) / device.storageTotal) * 100)}%)
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Cpu className="h-5 w-5" />
                  Memory
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Memory</p>
                  <p className="text-sm">{formatBytes(device.memoryTotal)}</p>
                </div>
                {device.batteryHealth && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Battery Health</p>
                    <p className="text-sm">{device.batteryHealth}%</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Phase 2: Mobile Device Information */}
          {(device.imei || device.phoneNumber) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Monitor className="h-5 w-5" />
                  Mobile Device Info
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {device.imei && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">IMEI</p>
                    <p className="text-sm font-mono">{device.imei}</p>
                  </div>
                )}
                {device.phoneNumber && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Phone Number</p>
                    <p className="text-sm font-mono">{device.phoneNumber}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Phase 3: Extended Hardware Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Hardware Deep Dive */}
            <HardwareDeepDiveCard 
              data={{
                meid: device.meid,
                iccid: device.iccid,
                udid: device.udid,
                subscriberCarrier: device.subscriberCarrier,
                batterySerialNumber: device.batterySerialNumber,
                batteryChargeCycles: device.batteryChargeCycles,
                batteryLevelPercentage: device.batteryLevelPercentage,
                residentUsersCount: device.residentUsersCount,
                productName: device.productName,
                deviceFullQualifiedDomainName: device.deviceFullQualifiedDomainName,
              }}
            />

            {/* Management Status */}
            <ManagementStatusCard
              data={{
                managementAgent: device.managementAgent,
                managementCertificateExpirationDate: device.managementCertificateExpirationDate ? new Date(device.managementCertificateExpirationDate) : null,
                managementFeatures: device.managementFeatures,
                remoteAssistanceSessionUrl: device.remoteAssistanceSessionUrl,
                remoteAssistanceSessionErrorDetails: device.remoteAssistanceSessionErrorDetails,
                requireUserEnrollmentApproval: device.requireUserEnrollmentApproval,
                enrollmentProfileName: device.enrollmentProfileName,
              }}
            />

            {/* Security Hardware */}
            <SecurityHardwareCard
              data={{
                tpmPresent: device.tpmPresent,
                secureBootEnabled: device.secureBootEnabled,
                codeIntegrityEnabled: device.codeIntegrityEnabled,
                bootDebuggingEnabled: device.bootDebuggingEnabled,
              }}
            />

            {/* Exchange ActiveSync */}
            <ExchangeActiveSyncCard
              data={{
                easActivated: device.easActivated,
                easDeviceId: device.easDeviceId,
                exchangeLastSuccessfulSyncDateTime: device.exchangeLastSuccessfulSyncDateTime ? new Date(device.exchangeLastSuccessfulSyncDateTime) : null,
              }}
            />

            {/* Malware Protection */}
            <MalwareProtectionCard
              data={{
                malwareActiveCount: device.malwareActiveCount,
                malwareRemediatedCount: device.malwareRemediatedCount,
              }}
              className="md:col-span-2"
            />

            {/* Device Analytics */}
            {deviceAnalytics && (
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Device Analytics
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-3 rounded-lg bg-muted">
                      <p className="text-2xl font-bold">{deviceAnalytics.overallScore ?? 'N/A'}</p>
                      <p className="text-xs text-muted-foreground">Overall Score</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-muted">
                      <p className="text-2xl font-bold">{deviceAnalytics.startupScore ?? 'N/A'}</p>
                      <p className="text-xs text-muted-foreground">Startup</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-muted">
                      <p className="text-2xl font-bold">{deviceAnalytics.appReliabilityScore ?? 'N/A'}</p>
                      <p className="text-xs text-muted-foreground">App Reliability</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-muted">
                      <p className="text-2xl font-bold">{deviceAnalytics.batteryScore ?? 'N/A'}</p>
                      <p className="text-xs text-muted-foreground">Battery</p>
                    </div>
                  </div>
                  {deviceAnalytics.healthStatus && (
                    <div className="mt-4">
                      <Badge variant={deviceAnalytics.healthStatus === 'Healthy' ? 'default' : 'destructive'}>
                        {deviceAnalytics.healthStatus}
                      </Badge>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Network Tab */}
        <TabsContent value="network" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wifi className="h-5 w-5" />
                Network Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm font-medium text-muted-foreground">IPv4 Address</p>
                <p className="text-sm font-mono">{device.ipAddressV4 || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">WiFi MAC Address</p>
                <p className="text-sm font-mono">{device.wifiMac || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Ethernet MAC Address</p>
                <p className="text-sm font-mono">{device.ethernetMac || 'N/A'}</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Raw Data Tab */}
        <TabsContent value="raw" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Code className="h-5 w-5" />
                Raw Device Data
              </CardTitle>
              <CardDescription>
                Complete device data from Microsoft Graph API
              </CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="p-4 rounded-lg bg-muted overflow-auto max-h-[600px] text-xs">
                {JSON.stringify(device.rawDeviceData || device, null, 2)}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
