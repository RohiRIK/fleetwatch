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
  ChevronDown,
  ChevronRight,
  AlertCircle,
  ShieldAlert,
  ShieldCheck,
  Users,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface PolicyBreakdown {
  policyId: string;
  policyName: string;
  riskLevel: 'critical' | 'high' | 'medium' | 'low';
  failedCount: number;
  affectedDevices: Array<{
    id: string;
    name: string;
    manufacturer: string;
    os: string;
    user: string;
  }>;
}

interface ComplianceData {
  summary: {
    totalDevices: number;
    compliantDevices: number;
    nonCompliantDevices: number;
    complianceRate: string;
    uniqueFailedPolicies: number;
    totalPolicyFailures: number;
  };
  policies: PolicyBreakdown[];
  complianceByRisk: {
    critical: { failed: number; total: number };
    high: { failed: number; total: number };
    medium: { failed: number; total: number };
    low: { failed: number; total: number };
  };
  complianceByOS: Array<{
    osName: string;
    total: number;
    compliant: number;
    nonCompliant: number;
    complianceRate: string;
  }>;
}

interface ComplianceHistory {
  date: string;
  compliant: number;
  nonCompliant: number;
  complianceRate: number;
}

export default function CompliancePage() {
  const [data, setData] = useState<ComplianceData | null>(null);
  const [history, setHistory] = useState<ComplianceHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedPolicies, setExpandedPolicies] = useState<Set<string>>(new Set());

  const loadData = async () => {
    setLoading(true);
    try {
      const [breakdownRes, historyRes] = await Promise.all([
        fetch('/api/compliance/breakdown'),
        fetch('/api/compliance/history'),
      ]);

      const breakdownData = await breakdownRes.json();
      if (breakdownData.success) {
        setData(breakdownData);
      }

      const historyData = await historyRes.json();
      if (historyData.success && historyData.history) {
        setHistory(historyData.history);
      }
    } catch (error) {
      console.error('Failed to load compliance data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const togglePolicy = (policyId: string) => {
    const newExpanded = new Set(expandedPolicies);
    if (newExpanded.has(policyId)) {
      newExpanded.delete(policyId);
    } else {
      newExpanded.add(policyId);
    }
    setExpandedPolicies(newExpanded);
  };

  const getRiskBadge = (riskLevel: string) => {
    switch (riskLevel) {
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
        return <Badge variant="outline">{riskLevel}</Badge>;
    }
  };

  const getRiskIcon = (riskLevel: string) => {
    switch (riskLevel) {
      case 'critical':
        return <ShieldAlert className="h-5 w-5 text-red-600" />;
      case 'high':
        return <AlertTriangle className="h-5 w-5 text-orange-600" />;
      case 'medium':
        return <AlertCircle className="h-5 w-5 text-amber-500" />;
      case 'low':
        return <Shield className="h-5 w-5 text-emerald-600" />;
      default:
        return <Shield className="h-5 w-5 text-muted-foreground" />;
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
            Failed to load compliance data
          </CardContent>
        </Card>
      </div>
    );
  }

  const { summary, policies, complianceByRisk, complianceByOS } = data;

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Device Compliance</h1>
          <p className="text-muted-foreground mt-1">
            Policy compliance status and risk analysis
          </p>
        </div>
        <Button variant="outline" onClick={loadData}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Compliance Rate */}
        <Card className="border-l-4 border-l-sky-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Compliance Rate</CardTitle>
            <ShieldCheck className="h-4 w-4 text-sky-500" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${summary.complianceRate === '0.0' ? 'text-red-600' : summary.complianceRate === '100.0' ? 'text-emerald-600' : 'text-amber-600'}`}>
              {summary.complianceRate}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {summary.compliantDevices} of {summary.totalDevices} devices
            </p>
          </CardContent>
        </Card>

        {/* Non-Compliant Devices */}
        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Non-Compliant</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{summary.nonCompliantDevices}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Devices requiring attention
            </p>
          </CardContent>
        </Card>

        {/* Failed Policies */}
        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed Policies</CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.uniqueFailedPolicies}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {summary.totalPolicyFailures} total violations
            </p>
          </CardContent>
        </Card>

        {/* Compliant Devices */}
        <Card className="border-l-4 border-l-emerald-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Compliant</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{summary.compliantDevices}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Devices meeting all policies
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Compliance by Risk Level */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5" />
            Compliance by Risk Level
          </CardTitle>
          <CardDescription>Policy failures categorized by severity</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Critical */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="destructive" className="bg-red-600 gap-1">
                  <XCircle className="h-3 w-3" />
                  Critical
                </Badge>
                <span className="text-sm text-muted-foreground">
                  Encryption, jailbreak, malware
                </span>
              </div>
              <span className="text-sm font-medium">{complianceByRisk.critical.failed} violations</span>
            </div>
            <Progress 
              value={complianceByRisk.critical.total > 0 ? (complianceByRisk.critical.failed / complianceByRisk.critical.total) * 100 : 0} 
              className="h-2"
              indicatorClassName="bg-red-600"
            />
          </div>

          {/* High */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="destructive" className="bg-orange-600 gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  High
                </Badge>
                <span className="text-sm text-muted-foreground">
                  OS version, Defender, passwords
                </span>
              </div>
              <span className="text-sm font-medium">{complianceByRisk.high.failed} violations</span>
            </div>
            <Progress 
              value={complianceByRisk.high.total > 0 ? (complianceByRisk.high.failed / complianceByRisk.high.total) * 100 : 0} 
              className="h-2"
              indicatorClassName="bg-orange-600"
            />
          </div>

          {/* Medium */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge className="bg-amber-500 gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Medium
                </Badge>
                <span className="text-sm text-muted-foreground">
                  Updates, security patches
                </span>
              </div>
              <span className="text-sm font-medium">{complianceByRisk.medium.failed} violations</span>
            </div>
            <Progress 
              value={complianceByRisk.medium.total > 0 ? (complianceByRisk.medium.failed / complianceByRisk.medium.total) * 100 : 0} 
              className="h-2"
              indicatorClassName="bg-amber-500"
            />
          </div>

          {/* Low */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Low
                </Badge>
                <span className="text-sm text-muted-foreground">
                  Minor policy violations
                </span>
              </div>
              <span className="text-sm font-medium">{complianceByRisk.low.failed} violations</span>
            </div>
            <Progress 
              value={complianceByRisk.low.total > 0 ? (complianceByRisk.low.failed / complianceByRisk.low.total) * 100 : 0} 
              className="h-2"
              indicatorClassName="bg-emerald-600"
            />
          </div>
        </CardContent>
      </Card>

      {/* Compliance by OS */}
      <Card>
        <CardHeader>
          <CardTitle>Compliance by Operating System</CardTitle>
          <CardDescription>Compliance rates across different platforms</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {complianceByOS.map((os) => (
            <div key={os.osName} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{os.osName}</span>
                  <span className="text-sm text-muted-foreground">
                    ({os.compliant}/{os.total} compliant)
                  </span>
                </div>
                <span className={`text-sm font-medium ${os.complianceRate === '0.0' ? 'text-red-600' : os.complianceRate === '100.0' ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {os.complianceRate}%
                </span>
              </div>
              <Progress 
                value={parseFloat(os.complianceRate)} 
                className="h-2"
                indicatorClassName={os.complianceRate === '0.0' ? 'bg-red-600' : os.complianceRate === '100.0' ? 'bg-emerald-600' : 'bg-amber-500'}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Compliance Timeline */}
      {history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Compliance Trend</CardTitle>
            <CardDescription>Historical compliance rate over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={history}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(value) => new Date(value).toLocaleDateString()}
                />
                <YAxis />
                <Tooltip 
                  labelFormatter={(value) => new Date(value as string).toLocaleString()}
                  formatter={(value, name) => {
                    if (value === undefined) return '';
                    if (name === 'complianceRate') return `${Number(value).toFixed(1)}%`;
                    return value;
                  }}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="compliant" 
                  stroke="#10b981" 
                  name="Compliant" 
                  strokeWidth={2}
                />
                <Line 
                  type="monotone" 
                  dataKey="nonCompliant" 
                  stroke="#ef4444" 
                  name="Non-Compliant" 
                  strokeWidth={2}
                />
                <Line 
                  type="monotone" 
                  dataKey="complianceRate" 
                  stroke="#0ea5e9" 
                  name="Compliance Rate (%)" 
                  strokeWidth={2}
                  strokeDasharray="5 5"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Policy Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Failed Policies
          </CardTitle>
          <CardDescription>
            Detailed breakdown of policy failures and affected devices
          </CardDescription>
        </CardHeader>
        <CardContent>
          {policies.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle2 className="h-12 w-12 mx-auto mb-2 text-emerald-500" />
              <p>All devices are compliant with all policies!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {policies.map((policy) => (
                <div
                  key={policy.policyId}
                  className="border rounded-lg overflow-hidden"
                >
                  {/* Policy Header */}
                  <div
                    className="flex items-center justify-between p-4 bg-card hover:bg-accent/50 cursor-pointer transition-colors"
                    onClick={() => togglePolicy(policy.policyId)}
                  >
                    <div className="flex items-center gap-3 flex-1">
                      {getRiskIcon(policy.riskLevel)}
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{policy.policyName}</p>
                          {getRiskBadge(policy.riskLevel)}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {policy.failedCount} device{policy.failedCount !== 1 ? 's' : ''} affected
                        </p>
                      </div>
                    </div>
                    {expandedPolicies.has(policy.policyId) ? (
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>

                  {/* Expanded Device List */}
                  {expandedPolicies.has(policy.policyId) && (
                    <div className="border-t bg-muted/30 p-4">
                      <p className="text-sm font-medium mb-3">Affected Devices:</p>
                      <div className="space-y-2">
                        {policy.affectedDevices.map((device) => (
                          <div
                            key={device.id}
                            className="flex items-center justify-between p-3 rounded-md bg-card border"
                          >
                            <div className="flex items-center gap-3">
                              <Users className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <p className="font-medium text-sm">{device.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {device.manufacturer} • {device.os}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-medium">{device.user}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
