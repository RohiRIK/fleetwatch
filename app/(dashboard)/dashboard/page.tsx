'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  HardDrive,
  Shield,
  AlertTriangle,
  Database,
  RefreshCw,
  Download,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock,
  Activity,
  TrendingUp,
  Users,
  Loader2,
  ChevronRight,
} from 'lucide-react';

interface DashboardData {
  success: boolean;
  criticalAlerts: {
    nonCompliantCount: number;
    lowDiskSpaceCount: number;
    failedSyncsCount: number;
    unencryptedCount: number;
  };
  summary: {
    totalDevices: number;
    nonCompliantDevices: number;
    unencryptedDevices: number;
    failedSyncs24h: number;
  };
  activityFeed: Array<{
    type: string;
    id: string;
    action: string;
    entityType?: string;
    metadata?: any;
    syncType?: string;
    recordsSynced?: number;
    recordsFailed?: number;
    errorMessage?: string;
    durationMs?: number;
    timestamp: string;
    completedAt?: string;
  }>;
  storageOverview: {
    totalStorage: string;
    storageFree: string;
    storageUsed: string;
    utilizationPercent: string;
  };
  deviceHealth: {
    compliant: number;
    nonCompliant: number;
    encrypted: number;
    unencrypted: number;
    complianceRate: string;
    encryptionRate: string;
  };
  devicesNeedingAttention: Array<{
    id: string;
    deviceName: string;
    manufacturer: string;
    model: string;
    operatingSystem: string;
    osVersion: string;
    userPrincipalName: string;
    userDisplayName: string;
    isCompliant: boolean;
    isEncrypted: boolean;
    complianceState: string;
    failedPoliciesCount: number;
    lastSyncAt: string;
  }>;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/dashboard/overview');
      const result = await response.json();
      if (result.success) {
        setData(result);
      }
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await fetch('/api/cron/sync-devices?mode=deep&syncUsers=true', {
        method: 'POST',
      });
      await loadDashboard();
    } catch (error) {
      console.error('Failed to sync:', error);
    } finally {
      setSyncing(false);
    }
  };

  const formatBytes = (bytes: string) => {
    const num = parseInt(bytes);
    if (!num) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(num) / Math.log(k));
    return `${(num / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleString();
  };

  const getActivityIcon = (activity: any) => {
    if (activity.type === 'sync') {
      return activity.errorMessage ? (
        <XCircle className="h-4 w-4 text-red-500" />
      ) : (
        <CheckCircle2 className="h-4 w-4 text-green-500" />
      );
    }
    switch (activity.action) {
      case 'DEVICE_ENROLLED':
        return <HardDrive className="h-4 w-4 text-blue-500" />;
      case 'COMPLIANCE_CHANGED':
        return <Shield className="h-4 w-4 text-amber-500" />;
      case 'LOGIN':
        return <Users className="h-4 w-4 text-cyan-500" />;
      default:
        return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  const getActivityDescription = (activity: any) => {
    if (activity.type === 'sync') {
      if (activity.errorMessage) {
        return `Sync failed: ${activity.errorMessage.substring(0, 80)}...`;
      }
      return `${activity.syncType.replace('_', ' ')} completed - ${activity.recordsSynced} records synced`;
    }
    
    switch (activity.action) {
      case 'DEVICE_ENROLLED':
        return `New device enrolled: ${activity.metadata?.deviceName || 'Unknown'}`;
      case 'COMPLIANCE_CHANGED':
        return `${activity.metadata?.deviceName || 'Device'} became ${activity.metadata?.isCompliant ? 'compliant' : 'non-compliant'}`;
      case 'LOGIN':
        return 'User logged in';
      case 'SYNC_FAILED':
        return `Device sync failed: ${activity.metadata?.deviceName || 'Unknown'}`;
      default:
        return activity.action.replace('_', ' ').toLowerCase();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="container mx-auto py-10">
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            Failed to load dashboard data
          </CardContent>
        </Card>
      </div>
    );
  }

  const criticalAlertsCount = 
    data.criticalAlerts.nonCompliantCount + 
    data.criticalAlerts.lowDiskSpaceCount + 
    data.criticalAlerts.failedSyncsCount +
    data.criticalAlerts.unencryptedCount;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            What needs your attention right now
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadDashboard} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={handleSync} disabled={syncing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            Sync Now
          </Button>
        </div>
      </div>

      {/* Critical Alerts Banner */}
      {criticalAlertsCount > 0 && (
        <Card className="border-l-4 border-l-red-500 bg-red-50 dark:bg-red-950/20">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <CardTitle className="text-red-900 dark:text-red-100">
                Critical Alerts ({criticalAlertsCount})
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.criticalAlerts.nonCompliantCount > 0 && (
              <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-900 rounded-md">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-red-500" />
                  <span className="font-medium">{data.criticalAlerts.nonCompliantCount} devices non-compliant</span>
                </div>
                <Link href="/compliance">
                  <Button size="sm" variant="destructive">
                    Fix Now
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            )}
            
            {data.criticalAlerts.unencryptedCount > 0 && (
              <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-900 rounded-md">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                  <span className="font-medium">{data.criticalAlerts.unencryptedCount} devices unencrypted</span>
                </div>
                <Link href="/compliance">
                  <Button size="sm" variant="outline">
                    View List
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            )}

            {data.criticalAlerts.lowDiskSpaceCount > 0 && (
              <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-900 rounded-md">
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-amber-500" />
                  <span className="font-medium">{data.criticalAlerts.lowDiskSpaceCount} devices with low disk space (&lt;10% free)</span>
                </div>
                <Link href="/inventory">
                  <Button size="sm" variant="outline">
                    View Devices
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            )}

            {data.criticalAlerts.failedSyncsCount > 0 && (
              <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-900 rounded-md">
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-500" />
                  <span className="font-medium">{data.criticalAlerts.failedSyncsCount} failed syncs in last 24 hours</span>
                </div>
                <Button size="sm" variant="outline" onClick={handleSync}>
                  Retry Sync
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-primary">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Devices</CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.summary.totalDevices}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Active devices in fleet
            </p>
            <Link href="/inventory">
              <Button variant="link" size="sm" className="mt-2 px-0">
                View all
                <ChevronRight className="ml-1 h-3 w-3" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className={`border-l-4 ${data.summary.nonCompliantDevices > 0 ? 'border-l-red-500' : 'border-l-green-500'}`}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Non-Compliant</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${data.summary.nonCompliantDevices > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {data.summary.nonCompliantDevices}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {data.deviceHealth.complianceRate}% compliant
            </p>
            <Link href="/compliance">
              <Button variant="link" size="sm" className="mt-2 px-0 text-red-600">
                Fix issues
                <ChevronRight className="ml-1 h-3 w-3" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className={`border-l-4 ${data.summary.unencryptedDevices > 0 ? 'border-l-amber-500' : 'border-l-cyan-500'}`}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unencrypted</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${data.summary.unencryptedDevices > 0 ? 'text-amber-600' : 'text-cyan-600'}`}>
              {data.summary.unencryptedDevices}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {data.deviceHealth.encryptionRate}% encrypted
            </p>
            <Link href="/compliance">
              <Button variant="link" size="sm" className="mt-2 px-0">
                View details
                <ChevronRight className="ml-1 h-3 w-3" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-cyan-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed Syncs (24h)</CardTitle>
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${data.summary.failedSyncs24h > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {data.summary.failedSyncs24h}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Sync operations
            </p>
            {data.summary.failedSyncs24h > 0 && (
              <Button variant="link" size="sm" className="mt-2 px-0" onClick={handleSync}>
                Retry sync
                <ChevronRight className="ml-1 h-3 w-3" />
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Activity Feed & Quick Actions Row */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Activity Feed */}
        <Card className="md:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Activity Feed</CardTitle>
                <CardDescription>Real-time events from your fleet</CardDescription>
              </div>
              <Activity className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 max-h-[400px] overflow-y-auto">
              {data.activityFeed.length === 0 ? (
                <p className="text-center text-muted-foreground text-sm py-8">
                  No recent activity
                </p>
              ) : (
                data.activityFeed.map((activity) => (
                  <div key={activity.id} className="flex items-start gap-3 pb-3 border-b last:border-0">
                    <div className="mt-1">{getActivityIcon(activity)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-none mb-1">
                        {getActivityDescription(activity)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatTimestamp(activity.timestamp)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions & Storage */}
        <div className="space-y-4">
          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button className="w-full justify-start" onClick={handleSync} disabled={syncing}>
                <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
                Sync All Devices
              </Button>
              <Link href="/inventory?isCompliant=false" className="block">
                <Button variant="outline" className="w-full justify-start">
                  <Shield className="mr-2 h-4 w-4" />
                  View Non-Compliant
                </Button>
              </Link>
              <Link href="/users" className="block">
                <Button variant="outline" className="w-full justify-start">
                  <Users className="mr-2 h-4 w-4" />
                  Manage Users
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Storage Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Storage Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total</span>
                  <span className="font-medium">{formatBytes(data.storageOverview.totalStorage)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Used</span>
                  <span className="font-medium">{formatBytes(data.storageOverview.storageUsed)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Free</span>
                  <span className="font-medium">{formatBytes(data.storageOverview.storageFree)}</span>
                </div>
              </div>
              
              <div className="pt-2">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Utilization</span>
                  <span className="font-bold text-primary">{data.storageOverview.utilizationPercent}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                  <div 
                    className="bg-primary h-2.5 rounded-full transition-all" 
                    style={{ width: `${data.storageOverview.utilizationPercent}%` }}
                  ></div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Device Health */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Device Health</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="text-sm">Compliant</span>
                </div>
                <span className="font-bold">{data.deviceHealth.compliant}</span>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-500" />
                  <span className="text-sm">Non-compliant</span>
                </div>
                <span className="font-bold text-red-600">{data.deviceHealth.nonCompliant}</span>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-cyan-500" />
                  <span className="text-sm">Encrypted</span>
                </div>
                <span className="font-bold">{data.deviceHealth.encrypted}</span>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                  <span className="text-sm">Unencrypted</span>
                </div>
                <span className="font-bold text-amber-600">{data.deviceHealth.unencrypted}</span>
              </div>
              
              <Link href="/compliance" className="block pt-2">
                <Button variant="outline" size="sm" className="w-full">
                  View Compliance Report
                  <ChevronRight className="ml-1 h-3 w-3" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Top Devices Needing Attention */}
      {data.devicesNeedingAttention.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Top Devices Needing Attention</CardTitle>
                <CardDescription>Sorted by number of compliance failures</CardDescription>
              </div>
              <Link href="/compliance">
                <Button variant="outline" size="sm">
                  View All
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.devicesNeedingAttention.map((device, index) => (
                <div key={device.id} className="flex items-start gap-4 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/20 text-red-600 font-bold text-sm">
                    {index + 1}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/devices/${device.id}`}
                        className="font-medium hover:underline"
                      >
                        {device.deviceName}
                      </Link>
                      <Badge variant="destructive" className="text-xs gap-1">
                        <XCircle className="h-3 w-3" />
                        {device.failedPoliciesCount} failed {device.failedPoliciesCount === 1 ? 'policy' : 'policies'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>{device.manufacturer} {device.model}</span>
                      <span>•</span>
                      <span>{device.operatingSystem} {device.osVersion}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground">User:</span>
                      <span>{device.userDisplayName || device.userPrincipalName || 'Unassigned'}</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    {!device.isCompliant && (
                      <Badge variant="destructive">
                        <XCircle className="h-3 w-3 mr-1" />
                        Non-compliant
                      </Badge>
                    )}
                    {!device.isEncrypted && (
                      <Badge variant="outline" className="border-amber-500 text-amber-600">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Not encrypted
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
