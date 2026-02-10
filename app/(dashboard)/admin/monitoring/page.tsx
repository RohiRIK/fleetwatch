/**
 * Monitoring Dashboard Page
 * /admin/monitoring
 * 
 * Displays system health, errors, logs, and performance metrics
 * Accessible to superadmins only
 */

"use client";

import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Activity, AlertCircle, FileText } from "lucide-react";
import { HealthStatusPanel } from "@/components/monitoring/health-status-panel";
import { PerformancePanel } from "@/components/monitoring/performance-panel";
import { ErrorListPanel } from "@/components/monitoring/error-list-panel";
import { LogViewerPanel } from "@/components/monitoring/log-viewer-panel";
import { 
  SystemHealth, 
  PerformanceMetrics, 
  SentryIssuesResponse, 
  LogQueryResult 
} from "@/lib/monitoring/types";

export default function MonitoringPage() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [errors, setErrors] = useState<SentryIssuesResponse | null>(null);
  const [logs, setLogs] = useState<LogQueryResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      setRefreshing(true);
      
      // Fetch all data in parallel
      const [healthRes, metricsRes, errorsRes, logsRes] = await Promise.all([
        fetch("/api/health"),
        fetch("/api/metrics"),
        fetch("/api/monitoring/errors"),
        fetch("/api/monitoring/logs?limit=50"),
      ]);

      if (healthRes.ok) {
        const data = await healthRes.json();
        setHealth(data.data);
      }

      if (metricsRes.ok) {
        const data = await metricsRes.json();
        setMetrics(data.data);
      }

      if (errorsRes.ok) {
        const data = await errorsRes.json();
        setErrors(data.data);
      }

      if (logsRes.ok) {
        const data = await logsRes.json();
        setLogs(data.data);
      }
    } catch (error) {
      console.error("Failed to fetch monitoring data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Auto-refresh every 60 seconds
    const interval = setInterval(fetchData, 60000);

    return () => clearInterval(interval);
  }, []);

  const handleSearchLogs = async (search: string) => {
    try {
      const res = await fetch(`/api/monitoring/logs?limit=50&search=${encodeURIComponent(search)}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.data);
      }
    } catch (error) {
      console.error("Failed to search logs:", error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" aria-label="Loading" />
          <p className="text-sm text-muted-foreground">Loading monitoring data…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">System Monitoring</h1>
          <p className="text-muted-foreground mt-1">
            Real-time health status, errors, and performance metrics
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchData}
          disabled={refreshing}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Health Status */}
      {health && (
        <div className="mb-6">
          <HealthStatusPanel health={health} />
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview" className="gap-2">
            <Activity className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="errors" className="gap-2">
            <AlertCircle className="h-4 w-4" />
            Errors {errors && errors.total > 0 && `(${errors.total})`}
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-2">
            <FileText className="h-4 w-4" />
            Logs {logs && logs.total > 0 && `(${logs.total})`}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {metrics ? (
            <PerformancePanel metrics={metrics} />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Performance Metrics</CardTitle>
                <CardDescription>No metrics available</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Performance metrics will appear here once data is collected.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="errors">
          {errors ? (
            <ErrorListPanel errors={errors.issues} />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Recent Errors</CardTitle>
                <CardDescription>No errors available</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Error data from Sentry will appear here when configured.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="logs">
          {logs ? (
            <LogViewerPanel logs={logs.logs} onSearch={handleSearchLogs} />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>System Logs</CardTitle>
                <CardDescription>No logs available</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  System logs will appear here once generated.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
