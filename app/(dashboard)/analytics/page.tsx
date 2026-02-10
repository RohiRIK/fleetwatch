'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { 
  TrendingUp, Download, RefreshCw, Shield, AlertTriangle,
  Database, Users, Loader2, Clock, Cpu, Activity, Laptop
} from 'lucide-react';

interface AnalyticsData {
  summary: {
    totalDevices: number;
    compliant: number;
    nonCompliant: number;
    complianceRate: string;
    encrypted: number;
    notEncrypted: number;
    encryptionRate: string;
  };
  osDistribution: Array<{ os: string; count: number }>;
  manufacturers: Array<{ manufacturer: string; count: number }>;
}

interface TrendsData {
  complianceTrend: Array<{
    date: string;
    compliant: number;
    nonCompliant: number;
    complianceRate: number;
  }>;
  deviceAgeDistribution: Array<{
    ageCategory: string;
    count: number;
  }>;
  policyFailureTrends: Array<{
    date: string;
    totalFailures: number;
    avgFailuresPerDevice: number;
  }>;
  encryptionTrend: Array<{
    date: string;
    encrypted: number;
    notEncrypted: number;
    encryptionRate: number;
  }>;
  userComplianceRanking: Array<{
    userDisplayName: string;
    userEmail: string;
    department: string | null;
    totalDevices: number;
    nonCompliantDevices: number;
    complianceRate: number;
  }>;
  storageCapacityWarnings: Array<{
    utilizationRange: string;
    count: number;
  }>;
  osBuildTrend: Array<{
    date: string;
    windowsCount: number;
    macosCount: number;
  }>;
  healthScoreTrend: Array<{
    date: string;
    avgHealthScore: number;
    totalDevices: number;
  }>;
  userActivityPatterns: Array<{
    activityCategory: string;
    count: number;
  }>;
  hardwareRefreshCandidates: Array<{
    deviceName: string;
    manufacturer: string;
    model: string;
    operatingSystem: string;
    osVersion: string;
    enrolledAt: string;
    userDisplayName: string;
    userEmail: string;
    reason: string;
  }>;
}

// Professional data visualization color palette
const CHART_COLORS = {
  primary: '#0ea5e9',     // Sky blue
  success: '#10b981',     // Emerald
  warning: '#f59e0b',     // Amber
  danger: '#ef4444',      // Red
  cyan: '#06b6d4',        // Cyan
  indigo: '#6366f1',      // Indigo
  teal: '#14b8a6',        // Teal
  emerald: '#059669',     // Dark emerald
};

const PIE_COLORS = [
  CHART_COLORS.primary,
  CHART_COLORS.success,
  CHART_COLORS.warning,
  CHART_COLORS.cyan,
  CHART_COLORS.indigo,
  CHART_COLORS.teal,
  CHART_COLORS.emerald,
  CHART_COLORS.danger,
];

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [trends, setTrends] = useState<TrendsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [analyticsRes, trendsRes] = await Promise.all([
        fetch('/api/analytics/overview'),
        fetch('/api/analytics/trends'),
      ]);
      
      const analyticsData = await analyticsRes.json();
      const trendsData = await trendsRes.json();
      
      setAnalytics(analyticsData);
      if (trendsData.success) {
        setTrends(trendsData);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportReport = () => {
    if (!analytics || !trends) return;
    
    const report = `FleetWatch Analytics Report
Generated: ${new Date().toLocaleString()}

=== SUMMARY ===
Total Devices: ${analytics.summary.totalDevices}
Compliance Rate: ${analytics.summary.complianceRate}%
Encryption Rate: ${analytics.summary.encryptionRate}%

=== OS DISTRIBUTION ===
${analytics.osDistribution.map(d => `${d.os}: ${d.count}`).join('\n')}

=== MANUFACTURERS ===
${analytics.manufacturers.map(d => `${d.manufacturer}: ${d.count}`).join('\n')}

=== HARDWARE REFRESH CANDIDATES ===
${trends.hardwareRefreshCandidates.map(h => `${h.deviceName} (${h.userEmail}) - ${h.reason}`).join('\n')}
`;

    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fleetwatch-analytics-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!analytics || !trends) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-muted-foreground">Failed to load analytics</p>
          <Button onClick={fetchData} className="mt-4">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-6">
      {/* Header Section */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between pb-2 border-b">
        <div>
          <h1 className="text-4xl font-bold tracking-tight mb-2">Analytics Dashboard</h1>
          <p className="text-base text-muted-foreground">
            Historical trends and strategic insights - actionable intelligence
          </p>
        </div>
        
        <div className="flex gap-3">
          <Button variant="outline" onClick={fetchData} className="cursor-pointer transition-colors">
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button onClick={exportReport} className="cursor-pointer transition-colors">
            <Download className="mr-2 h-4 w-4" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Section 1: Compliance & Security Trends */}
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-bold tracking-tight">Compliance & Security Trends</h2>
        </div>

        <div className="grid gap-6">
          {/* Compliance Trend */}
          {trends.complianceTrend.length > 0 && (
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Shield className="h-5 w-5 text-success" />
                  Compliance Trend (30 Days)
                </CardTitle>
                <CardDescription>Daily compliance status tracking - monitor policy adherence</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={trends.complianceTrend}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis 
                      dataKey="date"
                      tickFormatter={formatDate}
                      tick={{ fontSize: 13 }}
                      stroke="#888"
                    />
                    <YAxis yAxisId="left" stroke="#888" tick={{ fontSize: 13 }} />
                    <YAxis yAxisId="right" orientation="right" stroke="#888" tick={{ fontSize: 13 }} />
                    <Tooltip 
                      labelFormatter={(value) => new Date(value as string).toLocaleDateString()}
                      formatter={(value, name) => {
                        if (value === undefined) return '';
                        if (name === 'Compliance Rate (%)') return `${Number(value).toFixed(1)}%`;
                        return value;
                      }}
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', padding: '12px' }}
                    />
                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                    <Line 
                      yAxisId="left"
                      type="monotone" 
                      dataKey="compliant" 
                      stroke={CHART_COLORS.success}
                      name="Compliant Devices" 
                      strokeWidth={3}
                      dot={{ r: 4, strokeWidth: 2, fill: CHART_COLORS.success }}
                      activeDot={{ r: 6 }}
                    />
                    <Line 
                      yAxisId="left"
                      type="monotone" 
                      dataKey="nonCompliant" 
                      stroke={CHART_COLORS.danger}
                      name="Non-Compliant Devices" 
                      strokeWidth={3}
                      dot={{ r: 4, strokeWidth: 2, fill: CHART_COLORS.danger }}
                      activeDot={{ r: 6 }}
                    />
                    <Line 
                      yAxisId="right"
                      type="monotone" 
                      dataKey="complianceRate" 
                      stroke={CHART_COLORS.primary}
                      name="Compliance Rate (%)" 
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={{ r: 3, fill: CHART_COLORS.primary }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Policy Failure Trends */}
          {trends.policyFailureTrends.length > 0 && (
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <AlertTriangle className="h-5 w-5 text-danger" />
                  Policy Failure Trends
                </CardTitle>
                <CardDescription>Track policy violations over time - identify problematic policies</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={trends.policyFailureTrends}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis 
                      dataKey="date"
                      tickFormatter={formatDate}
                      tick={{ fontSize: 13 }}
                      stroke="#888"
                    />
                    <YAxis yAxisId="left" stroke="#888" tick={{ fontSize: 13 }} />
                    <YAxis yAxisId="right" orientation="right" stroke="#888" tick={{ fontSize: 13 }} />
                    <Tooltip 
                      labelFormatter={(value) => new Date(value as string).toLocaleDateString()}
                      formatter={(value) => {
                        if (value === undefined) return '';
                        return Number(value).toFixed(1);
                      }}
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', padding: '12px' }}
                    />
                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                    <Line 
                      yAxisId="left"
                      type="monotone" 
                      dataKey="totalFailures" 
                      stroke={CHART_COLORS.danger}
                      name="Total Policy Failures" 
                      strokeWidth={3}
                      dot={{ r: 4, strokeWidth: 2, fill: CHART_COLORS.danger }}
                      activeDot={{ r: 6 }}
                    />
                    <Line 
                      yAxisId="right"
                      type="monotone" 
                      dataKey="avgFailuresPerDevice" 
                      stroke={CHART_COLORS.warning}
                      name="Avg Failures Per Device" 
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={{ r: 3, fill: CHART_COLORS.warning }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Encryption Adoption Grid */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Encryption Adoption Trend */}
            {trends.encryptionTrend.length > 0 && (
              <Card className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Database className="h-5 w-5 text-warning" />
                    Encryption Adoption
                  </CardTitle>
                  <CardDescription>BitLocker/FileVault rollout progress</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={340}>
                    <AreaChart data={trends.encryptionTrend}>
                      <defs>
                        <linearGradient id="colorEncrypted" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={CHART_COLORS.success} stopOpacity={0.4}/>
                          <stop offset="95%" stopColor={CHART_COLORS.success} stopOpacity={0.05}/>
                        </linearGradient>
                        <linearGradient id="colorNotEncrypted" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={CHART_COLORS.danger} stopOpacity={0.4}/>
                          <stop offset="95%" stopColor={CHART_COLORS.danger} stopOpacity={0.05}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis 
                        dataKey="date"
                        tickFormatter={formatDate}
                        tick={{ fontSize: 12 }}
                        stroke="#888"
                      />
                      <YAxis stroke="#888" tick={{ fontSize: 12 }} />
                      <Tooltip 
                        labelFormatter={(value) => new Date(value as string).toLocaleDateString()}
                        formatter={(value, name) => {
                          if (value === undefined) return '';
                          if (name === 'Encryption Rate (%)') return `${Number(value).toFixed(1)}%`;
                          return value;
                        }}
                        contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', padding: '12px' }}
                      />
                      <Legend wrapperStyle={{ paddingTop: '15px', fontSize: '13px' }} />
                      <Area 
                        type="monotone" 
                        dataKey="encrypted" 
                        stackId="1"
                        stroke={CHART_COLORS.success}
                        fill="url(#colorEncrypted)"
                        name="Encrypted"
                        strokeWidth={2}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="notEncrypted" 
                        stackId="1"
                        stroke={CHART_COLORS.danger}
                        fill="url(#colorNotEncrypted)"
                        name="Not Encrypted"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* User Compliance Ranking */}
            {trends.userComplianceRanking.length > 0 && (
              <Card className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Users className="h-5 w-5 text-danger" />
                    User Compliance Ranking
                  </CardTitle>
                  <CardDescription>Priority training targets (Top 5)</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {trends.userComplianceRanking.slice(0, 5).map((user, index) => (
                      <div 
                        key={index} 
                        className="flex items-center justify-between p-4 rounded-lg border hover:border-primary hover:bg-accent/50 transition-all duration-200 cursor-pointer"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-500 to-red-600 text-white font-bold flex items-center justify-center text-base shadow-sm">
                            {index + 1}
                          </div>
                          <div>
                            <p className="font-semibold text-base">{user.userDisplayName}</p>
                            <p className="text-sm text-muted-foreground truncate max-w-[200px]">{user.userEmail}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-lg text-red-600">
                            {user.nonCompliantDevices}/{user.totalDevices}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {user.complianceRate.toFixed(0)}% compliant
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Section 2: OS & Platform Analytics */}
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Laptop className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-bold tracking-tight">OS & Platform Analytics</h2>
        </div>

        <div className="grid gap-6">
          {/* Windows/macOS Build Tracking */}
          {trends.osBuildTrend && trends.osBuildTrend.length > 0 && (
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Laptop className="h-5 w-5 text-primary" />
                  Windows vs macOS Device Count (30 Days)
                </CardTitle>
                <CardDescription>Track platform distribution over time</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={trends.osBuildTrend}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis 
                      dataKey="date"
                      tickFormatter={formatDate}
                      tick={{ fontSize: 13 }}
                      stroke="#888"
                    />
                    <YAxis stroke="#888" tick={{ fontSize: 13 }} />
                    <Tooltip 
                      labelFormatter={(value) => new Date(value as string).toLocaleDateString()}
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', padding: '12px' }}
                    />
                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                    <Line 
                      type="monotone" 
                      dataKey="windowsCount" 
                      stroke={CHART_COLORS.primary}
                      name="Windows Devices" 
                      strokeWidth={3}
                      dot={{ r: 5, strokeWidth: 2, fill: CHART_COLORS.primary }}
                      activeDot={{ r: 7 }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="macosCount" 
                      stroke={CHART_COLORS.teal}
                      name="macOS Devices" 
                      strokeWidth={3}
                      dot={{ r: 5, strokeWidth: 2, fill: CHART_COLORS.teal }}
                      activeDot={{ r: 7 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* OS Distribution Grid */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* OS Distribution */}
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="text-lg">Operating System Distribution</CardTitle>
                <CardDescription>Device count by OS platform</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={340}>
                  <PieChart>
                    <Pie
                      data={analytics.osDistribution}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(entry: any) => {
                        const { os, percent } = entry;
                        return percent ? `${os} (${(percent * 100).toFixed(0)}%)` : '';
                      }}
                      outerRadius={120}
                      fill="#8884d8"
                      dataKey="count"
                      nameKey="os"
                    >
                      {analytics.osDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Manufacturer Distribution */}
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="text-lg">Top Manufacturers</CardTitle>
                <CardDescription>Device count by manufacturer (top 10)</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={340}>
                  <BarChart data={analytics.manufacturers.slice(0, 10)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis type="number" stroke="#888" tick={{ fontSize: 12 }} />
                    <YAxis 
                      dataKey="manufacturer" 
                      type="category" 
                      width={120}
                      tick={{ fontSize: 12 }}
                      stroke="#888"
                    />
                    <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                    <Bar dataKey="count" name="Devices" radius={[0, 4, 4, 0]}>
                      {analytics.manufacturers.slice(0, 10).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Section 3: Fleet Health & Lifecycle */}
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Activity className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-bold tracking-tight">Fleet Health & Lifecycle</h2>
        </div>

        <div className="grid gap-6">
          {/* Health Score + Device Age */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Device Health Score Trend */}
            {trends.healthScoreTrend && trends.healthScoreTrend.length > 0 && (
              <Card className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Activity className="h-5 w-5 text-success" />
                    Device Health Score Trend
                  </CardTitle>
                  <CardDescription>Composite score: Compliance (40%) + Encryption (30%) + Recent Sync (30%)</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={340}>
                    <AreaChart data={trends.healthScoreTrend}>
                      <defs>
                        <linearGradient id="colorHealth" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={CHART_COLORS.success} stopOpacity={0.4}/>
                          <stop offset="95%" stopColor={CHART_COLORS.success} stopOpacity={0.05}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis 
                        dataKey="date"
                        tickFormatter={formatDate}
                        tick={{ fontSize: 12 }}
                        stroke="#888"
                      />
                      <YAxis stroke="#888" tick={{ fontSize: 12 }} domain={[0, 100]} />
                      <Tooltip 
                        labelFormatter={(value) => new Date(value as string).toLocaleDateString()}
                        formatter={(value) => {
                          if (value === undefined) return '';
                          return `${Number(value).toFixed(1)}/100`;
                        }}
                        contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', padding: '12px' }}
                      />
                      <Legend wrapperStyle={{ paddingTop: '15px' }} />
                      <Area 
                        type="monotone" 
                        dataKey="avgHealthScore" 
                        stroke={CHART_COLORS.success}
                        fill="url(#colorHealth)"
                        name="Avg Health Score"
                        strokeWidth={3}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Device Age Distribution */}
            {trends.deviceAgeDistribution.length > 0 && (
              <Card className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Clock className="h-5 w-5 text-indigo" />
                    Device Age Distribution
                  </CardTitle>
                  <CardDescription>Fleet age analysis - identify aging devices</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={340}>
                    <BarChart data={trends.deviceAgeDistribution}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis 
                        dataKey="ageCategory"
                        tick={{ fontSize: 11 }}
                        stroke="#888"
                      />
                      <YAxis stroke="#888" tick={{ fontSize: 12 }} />
                      <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                      <Bar 
                        dataKey="count" 
                        fill={CHART_COLORS.indigo}
                        name="Devices"
                        radius={[6, 6, 0, 0]}
                      >
                        {trends.deviceAgeDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </div>

          {/* User Activity + Storage Warnings */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* User Activity Patterns */}
            {trends.userActivityPatterns && trends.userActivityPatterns.length > 0 && (
              <Card className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Users className="h-5 w-5 text-primary" />
                    User Activity Patterns
                  </CardTitle>
                  <CardDescription>Last login activity distribution</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={340}>
                    <BarChart data={trends.userActivityPatterns}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis 
                        dataKey="activityCategory"
                        tick={{ fontSize: 11 }}
                        stroke="#888"
                      />
                      <YAxis stroke="#888" tick={{ fontSize: 12 }} />
                      <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                      <Bar 
                        dataKey="count" 
                        name="Devices" 
                        radius={[6, 6, 0, 0]}
                      >
                        {trends.userActivityPatterns.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={
                              entry.activityCategory === 'Active (24h)' ? CHART_COLORS.success :
                              entry.activityCategory === 'Recent (7d)' ? CHART_COLORS.primary :
                              entry.activityCategory === 'Inactive (30d)' ? CHART_COLORS.warning :
                              entry.activityCategory === 'Stale (90d)' ? CHART_COLORS.danger :
                              '#9ca3af'
                            } 
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Storage Capacity Warnings */}
            {trends.storageCapacityWarnings.length > 0 && (
              <Card className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Database className="h-5 w-5 text-danger" />
                    Storage Capacity Warnings
                  </CardTitle>
                  <CardDescription>Devices by storage utilization level</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={340}>
                    <BarChart data={trends.storageCapacityWarnings}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis 
                        dataKey="utilizationRange" 
                        tick={{ fontSize: 11 }}
                        stroke="#888"
                      />
                      <YAxis stroke="#888" tick={{ fontSize: 12 }} />
                      <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                      <Bar 
                        dataKey="count" 
                        name="Devices" 
                        radius={[6, 6, 0, 0]}
                      >
                        {trends.storageCapacityWarnings.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={
                              entry.utilizationRange === '90-100% Full' ? CHART_COLORS.danger :
                              entry.utilizationRange === '80-90% Full' ? CHART_COLORS.warning :
                              entry.utilizationRange === '70-80% Full' ? '#eab308' :
                              CHART_COLORS.success
                            } 
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Hardware Refresh Candidates */}
          {trends.hardwareRefreshCandidates && trends.hardwareRefreshCandidates.length > 0 && (
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Cpu className="h-5 w-5 text-warning" />
                  Hardware Refresh Candidates
                </CardTitle>
                <CardDescription>Devices requiring replacement or upgrade (Top 10)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {trends.hardwareRefreshCandidates.slice(0, 10).map((device, index) => (
                    <div 
                      key={index} 
                      className="flex items-center justify-between p-4 rounded-lg border hover:border-warning hover:bg-accent/50 transition-all duration-200 cursor-pointer"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 text-white font-bold flex items-center justify-center text-base shadow-sm">
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-semibold text-base">{device.deviceName}</p>
                          <p className="text-sm text-muted-foreground">
                            {device.manufacturer} {device.model} • {device.operatingSystem}
                          </p>
                          <p className="text-xs text-muted-foreground">{device.userEmail}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-semibold text-warning uppercase">{device.reason}</p>
                        <p className="text-xs text-muted-foreground">
                          Enrolled: {new Date(device.enrolledAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
