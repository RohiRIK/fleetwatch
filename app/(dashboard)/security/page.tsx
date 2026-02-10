'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Shield,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Lock,
  Unlock,
  Flame,
  Cpu,
  Key,
  AlertCircle,
  Download,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import Link from 'next/link';

interface SecurityStats {
  totalDevices: number;
  bitLockerEnabled: number;
  bitLockerDisabled: number;
  bitLockerUnknown: number;
  defenderEnabled: number;
  defenderDisabled: number;
  defenderUnknown: number;
  firewallEnabled: number;
  firewallDisabled: number;
  firewallUnknown: number;
  tpmPresent: number;
  tpmAbsent: number;
  tpmUnknown: number;
  secureBootEnabled: number;
  secureBootDisabled: number;
  secureBootUnknown: number;
  threatsDetected: number;
  jailBroken: number;
}

interface SecurityIssue {
  id: string;
  deviceName: string;
  operatingSystem: string;
  userDisplayName: string;
  userEmail: string;
  issues: string[];
  severity: 'critical' | 'high' | 'medium' | 'low';
}

interface FleetSecurityData {
  success: boolean;
  stats: SecurityStats;
  percentages: {
    bitLockerEnabled: string;
    defenderEnabled: string;
    firewallEnabled: string;
    tpmPresent: string;
    secureBootEnabled: string;
  };
  securityIssues: SecurityIssue[];
  securityIssueCount: number;
  criticalIssues: number;
  highIssues: number;
  mediumIssues: number;
  lowIssues: number;
}

const COLORS = {
  success: '#10b981', // Emerald
  danger: '#ef4444',  // Red
  warning: '#f59e0b', // Amber
  muted: '#9ca3af',   // Gray
};

const PIE_COLORS = [COLORS.success, COLORS.danger, COLORS.warning, COLORS.muted];

export default function SecurityDashboard() {
  const [data, setData] = useState<FleetSecurityData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/security/fleet');
      const json = await res.json();
      if (json.success) {
        setData(json);
      }
    } catch (error) {
      console.error('Failed to load security data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const res = await fetch('/api/security/fleet/export');
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `security-report-${new Date().toISOString().split('T')[0]}.csv`;
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

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical':
        return (
          <Badge variant="destructive" className="bg-red-600 gap-1">
            <XCircle className="h-3 w-3" />
            Critical
          </Badge>
        );
      case 'high':
        return (
          <Badge variant="destructive" className="bg-orange-600 gap-1">
            <AlertTriangle className="h-3 w-3" />
            High
          </Badge>
        );
      case 'medium':
        return (
          <Badge className="bg-amber-500 gap-1">
            <AlertCircle className="h-3 w-3" />
            Medium
          </Badge>
        );
      case 'low':
        return (
          <Badge variant="secondary" className="gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Low
          </Badge>
        );
      default:
        return <Badge variant="outline">{severity}</Badge>;
    }
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
            Failed to load security data
          </CardContent>
        </Card>
      </div>
    );
  }

  const { stats, percentages, securityIssues } = data;

  // Prepare chart data
  const encryptionData = [
    { name: 'Encrypted', value: stats.bitLockerEnabled, color: COLORS.success },
    { name: 'Not Encrypted', value: stats.bitLockerDisabled, color: COLORS.danger },
    { name: 'Unknown', value: stats.bitLockerUnknown, color: COLORS.muted },
  ].filter(d => d.value > 0);

  const defenderData = [
    { name: 'Enabled', value: stats.defenderEnabled, color: COLORS.success },
    { name: 'Disabled', value: stats.defenderDisabled, color: COLORS.danger },
    { name: 'Unknown', value: stats.defenderUnknown, color: COLORS.muted },
  ].filter(d => d.value > 0);

  const firewallData = [
    { name: 'Enabled', value: stats.firewallEnabled, color: COLORS.success },
    { name: 'Disabled', value: stats.firewallDisabled, color: COLORS.danger },
    { name: 'Unknown', value: stats.firewallUnknown, color: COLORS.muted },
  ].filter(d => d.value > 0);

  const tpmData = [
    { name: 'Present', value: stats.tpmPresent, color: COLORS.success },
    { name: 'Absent', value: stats.tpmAbsent, color: COLORS.danger },
    { name: 'Unknown', value: stats.tpmUnknown, color: COLORS.muted },
  ].filter(d => d.value > 0);

  const securityBarData = [
    { name: 'Encryption', enabled: stats.bitLockerEnabled, disabled: stats.bitLockerDisabled },
    { name: 'Defender', enabled: stats.defenderEnabled, disabled: stats.defenderDisabled },
    { name: 'Firewall', enabled: stats.firewallEnabled, disabled: stats.firewallDisabled },
    { name: 'TPM', enabled: stats.tpmPresent, disabled: stats.tpmAbsent },
    { name: 'Secure Boot', enabled: stats.secureBootEnabled, disabled: stats.secureBootDisabled },
  ];

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <ShieldCheck className="h-8 w-8 text-emerald-600" />
            Security Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            Fleet-wide security posture monitoring - BitLocker, Defender, Firewall, TPM
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

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Devices */}
        <Card className="border-l-4 border-l-sky-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Devices</CardTitle>
            <Shield className="h-4 w-4 text-sky-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalDevices}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Fleet monitored
            </p>
          </CardContent>
        </Card>

        {/* Encryption Status */}
        <Card className="border-l-4 border-l-emerald-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Encryption Rate</CardTitle>
            <Lock className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{percentages.bitLockerEnabled}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.bitLockerEnabled} of {stats.totalDevices} encrypted
            </p>
          </CardContent>
        </Card>

        {/* Security Issues */}
        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Security Issues</CardTitle>
            <ShieldAlert className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{data.securityIssueCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {data.criticalIssues} critical, {data.highIssues} high
            </p>
          </CardContent>
        </Card>

        {/* Threats Detected */}
        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Threats Detected</CardTitle>
            <Flame className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{stats.threatsDetected}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.jailBroken} jailbroken devices
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Security Posture Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security Posture Overview
          </CardTitle>
          <CardDescription>Enabled vs Disabled security features across fleet</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={securityBarData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="enabled" fill={COLORS.success} name="Enabled" />
              <Bar dataKey="disabled" fill={COLORS.danger} name="Disabled" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Security Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* BitLocker/Encryption */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Lock className="h-5 w-5 text-emerald-600" />
              BitLocker / Encryption
            </CardTitle>
            <CardDescription>Disk encryption status (BitLocker, FileVault)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  Enabled
                </span>
                <span className="text-sm font-bold text-emerald-600">{stats.bitLockerEnabled}</span>
              </div>
              <Progress value={(stats.bitLockerEnabled / stats.totalDevices) * 100} className="h-2" indicatorClassName="bg-emerald-600" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-600" />
                  Disabled
                </span>
                <span className="text-sm font-bold text-red-600">{stats.bitLockerDisabled}</span>
              </div>
              <Progress value={(stats.bitLockerDisabled / stats.totalDevices) * 100} className="h-2" indicatorClassName="bg-red-600" />
            </div>
            {stats.bitLockerUnknown > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-gray-500" />
                    Unknown
                  </span>
                  <span className="text-sm font-bold text-gray-500">{stats.bitLockerUnknown}</span>
                </div>
                <Progress value={(stats.bitLockerUnknown / stats.totalDevices) * 100} className="h-2" indicatorClassName="bg-gray-500" />
              </div>
            )}
            {encryptionData.length > 0 && (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={encryptionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {encryptionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Windows Defender */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ShieldCheck className="h-5 w-5 text-sky-600" />
              Windows Defender
            </CardTitle>
            <CardDescription>Antivirus protection status (Windows devices)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  Enabled
                </span>
                <span className="text-sm font-bold text-emerald-600">{stats.defenderEnabled}</span>
              </div>
              <Progress value={stats.totalDevices > 0 ? (stats.defenderEnabled / stats.totalDevices) * 100 : 0} className="h-2" indicatorClassName="bg-emerald-600" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-600" />
                  Disabled
                </span>
                <span className="text-sm font-bold text-red-600">{stats.defenderDisabled}</span>
              </div>
              <Progress value={stats.totalDevices > 0 ? (stats.defenderDisabled / stats.totalDevices) * 100 : 0} className="h-2" indicatorClassName="bg-red-600" />
            </div>
            {stats.defenderUnknown > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-gray-500" />
                    Unknown
                  </span>
                  <span className="text-sm font-bold text-gray-500">{stats.defenderUnknown}</span>
                </div>
                <Progress value={stats.totalDevices > 0 ? (stats.defenderUnknown / stats.totalDevices) * 100 : 0} className="h-2" indicatorClassName="bg-gray-500" />
              </div>
            )}
            {defenderData.length > 0 && (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={defenderData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {defenderData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Firewall */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Flame className="h-5 w-5 text-orange-600" />
              Firewall Status
            </CardTitle>
            <CardDescription>Network firewall protection</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  Enabled
                </span>
                <span className="text-sm font-bold text-emerald-600">{stats.firewallEnabled}</span>
              </div>
              <Progress value={stats.totalDevices > 0 ? (stats.firewallEnabled / stats.totalDevices) * 100 : 0} className="h-2" indicatorClassName="bg-emerald-600" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-600" />
                  Disabled
                </span>
                <span className="text-sm font-bold text-red-600">{stats.firewallDisabled}</span>
              </div>
              <Progress value={stats.totalDevices > 0 ? (stats.firewallDisabled / stats.totalDevices) * 100 : 0} className="h-2" indicatorClassName="bg-red-600" />
            </div>
            {stats.firewallUnknown > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-gray-500" />
                    Unknown
                  </span>
                  <span className="text-sm font-bold text-gray-500">{stats.firewallUnknown}</span>
                </div>
                <Progress value={stats.totalDevices > 0 ? (stats.firewallUnknown / stats.totalDevices) * 100 : 0} className="h-2" indicatorClassName="bg-gray-500" />
              </div>
            )}
            {firewallData.length > 0 && (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={firewallData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {firewallData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* TPM */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Cpu className="h-5 w-5 text-indigo-600" />
              TPM (Trusted Platform Module)
            </CardTitle>
            <CardDescription>Hardware security chip status (Windows devices)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  Present
                </span>
                <span className="text-sm font-bold text-emerald-600">{stats.tpmPresent}</span>
              </div>
              <Progress value={stats.totalDevices > 0 ? (stats.tpmPresent / stats.totalDevices) * 100 : 0} className="h-2" indicatorClassName="bg-emerald-600" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-600" />
                  Absent
                </span>
                <span className="text-sm font-bold text-red-600">{stats.tpmAbsent}</span>
              </div>
              <Progress value={stats.totalDevices > 0 ? (stats.tpmAbsent / stats.totalDevices) * 100 : 0} className="h-2" indicatorClassName="bg-red-600" />
            </div>
            {stats.tpmUnknown > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-gray-500" />
                    Unknown
                  </span>
                  <span className="text-sm font-bold text-gray-500">{stats.tpmUnknown}</span>
                </div>
                <Progress value={stats.totalDevices > 0 ? (stats.tpmUnknown / stats.totalDevices) * 100 : 0} className="h-2" indicatorClassName="bg-gray-500" />
              </div>
            )}
            {tpmData.length > 0 && (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={tpmData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {tpmData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Secure Boot Status */}
      {(stats.secureBootEnabled > 0 || stats.secureBootDisabled > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5 text-purple-600" />
              Secure Boot Status
            </CardTitle>
            <CardDescription>UEFI Secure Boot configuration (Windows devices)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex flex-col items-center p-4 border rounded-lg">
                <CheckCircle2 className="h-8 w-8 text-emerald-600 mb-2" />
                <div className="text-2xl font-bold text-emerald-600">{stats.secureBootEnabled}</div>
                <div className="text-sm text-muted-foreground">Enabled</div>
              </div>
              <div className="flex flex-col items-center p-4 border rounded-lg">
                <XCircle className="h-8 w-8 text-red-600 mb-2" />
                <div className="text-2xl font-bold text-red-600">{stats.secureBootDisabled}</div>
                <div className="text-sm text-muted-foreground">Disabled</div>
              </div>
              <div className="flex flex-col items-center p-4 border rounded-lg">
                <AlertCircle className="h-8 w-8 text-gray-500 mb-2" />
                <div className="text-2xl font-bold text-gray-500">{stats.secureBootUnknown}</div>
                <div className="text-sm text-muted-foreground">Unknown</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Security Issues List */}
      {securityIssues.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-red-600" />
              Devices with Security Issues
            </CardTitle>
            <CardDescription>
              {data.securityIssueCount} device{data.securityIssueCount !== 1 ? 's' : ''} require attention
              {data.criticalIssues > 0 && ` (${data.criticalIssues} critical)`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {securityIssues.slice(0, 20).map((issue) => (
                <Link 
                  key={issue.id} 
                  href={`/devices/${issue.id}`}
                  className="block"
                >
                  <div className="flex items-center justify-between p-4 rounded-lg border hover:border-primary hover:bg-accent/50 transition-all cursor-pointer">
                    <div className="flex items-center gap-4 flex-1">
                      <ShieldAlert className={`h-5 w-5 ${
                        issue.severity === 'critical' ? 'text-red-600' :
                        issue.severity === 'high' ? 'text-orange-600' :
                        issue.severity === 'medium' ? 'text-amber-500' :
                        'text-gray-500'
                      }`} />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-semibold text-sm">{issue.deviceName}</p>
                          {getSeverityBadge(issue.severity)}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {issue.operatingSystem} • {issue.userDisplayName}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {issue.issues.map((iss, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {iss}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
            {securityIssues.length > 20 && (
              <p className="text-sm text-muted-foreground text-center mt-4">
                Showing 20 of {securityIssues.length} devices with issues
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* No Issues State */}
      {securityIssues.length === 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <ShieldCheck className="h-16 w-16 mx-auto mb-4 text-emerald-500" />
              <h3 className="text-lg font-semibold mb-2">Excellent Security Posture!</h3>
              <p className="text-muted-foreground">
                All devices meet security requirements. No issues detected.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
