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
  userPrincipalName: string | null;
  userDisplayName: string | null;
  userEmail: string | null;
  userDepartment: string | null;
  storageTotal: number | null;
  storageFree: number | null;
  memoryTotal: number | null;
  batteryHealth: number | null;
  chassisType: string | null;
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
}

export default function DeviceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = use(params);
  const id = unwrappedParams.id;
  const router = useRouter();
  const [device, setDevice] = useState<Device | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDevice = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/devices/${id}`);
        const data = await response.json();
        if (data.success) {
          setDevice(data.device);
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
              </div>

              {device.complianceDetails && (
                <div className="mt-4">
                  <h3 className="font-medium mb-2">Compliance Policies</h3>
                  <div className="space-y-2">
                    {Array.isArray(device.complianceDetails) && device.complianceDetails.length > 0 ? (
                      device.complianceDetails.map((policy: any, index: number) => (
                        <div key={index} className="p-3 rounded-lg border">
                          <p className="font-medium text-sm">{policy.displayName || 'Policy ' + (index + 1)}</p>
                          <p className="text-xs text-muted-foreground">{policy.state || 'Unknown state'}</p>
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
