'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Package,
  Search,
  RefreshCw,
  Loader2,
  TrendingUp,
  AlertTriangle,
  Users,
  DollarSign,
  Laptop,
  Download,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

interface AppDevice {
  id: string;
  deviceName: string;
  operatingSystem: string;
  userDisplayName: string;
  userEmail: string;
  version: string;
  installedOn?: string;
}

interface AppVersion {
  version: string;
  count: number;
}

interface AppData {
  displayName: string;
  publisher: string;
  version: string;
  installCount: number;
  devices: AppDevice[];
  versions: AppVersion[];
  hasMultipleVersions: boolean;
}

interface LicenseOpportunity {
  displayName: string;
  publisher: string;
  installCount: number;
  devices: AppDevice[];
}

interface VersionFragmentation {
  displayName: string;
  publisher: string;
  installCount: number;
  versionCount: number;
  versions: AppVersion[];
}

interface InventoryData {
  success: boolean;
  summary: {
    totalDevices: number;
    totalUniqueApps: number;
    totalAppInstallations: number;
    averageAppsPerDevice: string;
    microsoftAppsCount: number;
    adobeAppsCount: number;
  };
  apps: AppData[];
  topApps: AppData[];
  licenseOpportunities: LicenseOpportunity[];
  versionFragmentation: VersionFragmentation[];
  microsoftApps: AppData[];
  adobeApps: AppData[];
}

const COLORS = {
  primary: '#0ea5e9',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  purple: '#a855f7',
  cyan: '#06b6d4',
  indigo: '#6366f1',
  pink: '#ec4899',
};

const PIE_COLORS = [
  COLORS.primary,
  COLORS.success,
  COLORS.warning,
  COLORS.purple,
  COLORS.cyan,
  COLORS.indigo,
  COLORS.pink,
  COLORS.danger,
];

export default function AppsInventoryPage() {
  const [data, setData] = useState<InventoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [minInstalls, setMinInstalls] = useState(1);
  const [expandedApp, setExpandedApp] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.set('search', searchTerm);
      params.set('minInstalls', minInstalls.toString());

      const res = await fetch(`/api/apps/inventory?${params}`);
      const json = await res.json();
      if (json.success) {
        setData(json);
      }
    } catch (error) {
      console.error('Failed to load app inventory:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.set('search', searchTerm);
      params.set('minInstalls', minInstalls.toString());

      const res = await fetch(`/api/apps/inventory/export?${params}`);
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `app-inventory-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      } else {
        console.error('Export failed');
        alert('Export failed. Please try again.');
      }
    } catch (error) {
      console.error('Export error:', error);
      alert('Export failed. Please try again.');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  if (loading) {
    return (
      <div className="container mx-auto py-10 flex items-center justify-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="container mx-auto py-10">
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            Failed to load app inventory
          </CardContent>
        </Card>
      </div>
    );
  }

  const { summary, topApps, licenseOpportunities, versionFragmentation, microsoftApps, adobeApps } = data;

  // Prepare chart data
  const topAppsChart = topApps.slice(0, 10).map(app => ({
    name: app.displayName.length > 30 ? app.displayName.substring(0, 27) + '...' : app.displayName,
    installs: app.installCount,
  }));

  const publisherDistribution = data.apps.reduce((acc: any, app) => {
    const publisher = app.publisher === 'Unknown Publisher' ? 'Unknown' : app.publisher;
    if (!acc[publisher]) {
      acc[publisher] = { name: publisher, value: 0 };
    }
    acc[publisher].value += app.installCount;
    return acc;
  }, {});

  const publisherData = Object.values(publisherDistribution)
    .sort((a: any, b: any) => b.value - a.value)
    .slice(0, 8);

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Package className="h-8 w-8 text-sky-600" />
            App Inventory
          </h1>
          <p className="text-muted-foreground mt-1">
            Software catalog, license optimization, and version management
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <Button variant="outline" onClick={loadData}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Search Bar */}
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSearch} className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search apps by name or publisher..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="w-32">
              <Input
                type="number"
                placeholder="Min installs"
                value={minInstalls}
                onChange={(e) => setMinInstalls(parseInt(e.target.value) || 1)}
                min="1"
              />
            </div>
            <Button type="submit">Search</Button>
          </form>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-sky-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Apps</CardTitle>
            <Package className="h-4 w-4 text-sky-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalUniqueApps}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {summary.totalAppInstallations} total installs
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Per Device</CardTitle>
            <Laptop className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.averageAppsPerDevice}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Across {summary.totalDevices} devices
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">License Waste</CardTitle>
            <DollarSign className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{licenseOpportunities.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Potential savings opportunities
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Version Issues</CardTitle>
            <AlertTriangle className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{versionFragmentation.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Apps with multiple versions
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Apps */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-sky-600" />
              Top 10 Apps by Install Count
            </CardTitle>
            <CardDescription>Most widely deployed applications</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={topAppsChart} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="installs" fill={COLORS.primary} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Publisher Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-emerald-600" />
              Top Publishers
            </CardTitle>
            <CardDescription>Distribution by software publisher</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <PieChart>
                <Pie
                  data={publisherData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry: any) => {
                    const name = entry.name.length > 15 ? entry.name.substring(0, 12) + '...' : entry.name;
                    return `${name} (${entry.value})`;
                  }}
                  outerRadius={120}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {publisherData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* License Optimization Opportunities */}
      {licenseOpportunities.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-amber-600" />
              License Optimization Opportunities
            </CardTitle>
            <CardDescription>
              Premium apps with low deployment - potential cost savings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {licenseOpportunities.map((app, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-4 rounded-lg border hover:border-amber-500 hover:bg-accent/50 transition-all cursor-pointer"
                  onClick={() => setExpandedApp(expandedApp === app.displayName ? null : app.displayName)}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-sm">{app.displayName}</p>
                      <Badge variant="outline" className="text-xs">
                        {app.publisher}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Only {app.installCount} of {summary.totalDevices} devices ({((app.installCount / summary.totalDevices) * 100).toFixed(0)}%) - Review license necessity
                    </p>
                    {expandedApp === app.displayName && (
                      <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                        {app.devices.slice(0, 5).map((device, didx) => (
                          <div key={didx} className="flex justify-between">
                            <span>{device.deviceName}</span>
                            <span>{device.userDisplayName}</span>
                          </div>
                        ))}
                        {app.devices.length > 5 && (
                          <p className="text-center italic">... and {app.devices.length - 5} more</p>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-amber-600">{app.installCount}</div>
                    <div className="text-xs text-muted-foreground">installs</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Version Fragmentation */}
      {versionFragmentation.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-purple-600" />
              Version Fragmentation
            </CardTitle>
            <CardDescription>
              Apps with multiple versions deployed - potential update issues
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {versionFragmentation.map((app, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-lg border hover:border-purple-500 hover:bg-accent/50 transition-all"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex-1">
                      <p className="font-semibold text-sm">{app.displayName}</p>
                      <p className="text-xs text-muted-foreground">{app.publisher}</p>
                    </div>
                    <Badge variant="outline" className="text-purple-600">
                      {app.versionCount} versions
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3">
                    {app.versions.map((ver, vidx) => (
                      <div key={vidx} className="flex items-center justify-between text-xs p-2 bg-muted rounded">
                        <span className="font-mono truncate">{ver.version}</span>
                        <Badge variant="secondary" className="ml-2 text-xs">{ver.count}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Microsoft Apps */}
      {microsoftApps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-sky-600" />
              Microsoft Apps
            </CardTitle>
            <CardDescription>
              {summary.microsoftAppsCount} Microsoft applications deployed
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {microsoftApps.slice(0, 10).map((app, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{app.displayName}</p>
                    <p className="text-xs text-muted-foreground">
                      {app.hasMultipleVersions ? `${app.versions.length} versions` : app.version}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-sky-600">{app.installCount}</div>
                    <div className="text-xs text-muted-foreground">installs</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Adobe Apps */}
      {adobeApps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-red-600" />
              Adobe Apps
            </CardTitle>
            <CardDescription>
              {summary.adobeAppsCount} Adobe applications deployed
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {adobeApps.slice(0, 10).map((app, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{app.displayName}</p>
                    <p className="text-xs text-muted-foreground">
                      {app.hasMultipleVersions ? `${app.versions.length} versions` : app.version}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-red-600">{app.installCount}</div>
                    <div className="text-xs text-muted-foreground">installs</div>
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
