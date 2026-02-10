/**
 * Performance Panel Component
 * Displays performance metrics (response times, cache stats, request stats)
 */

"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PerformanceMetrics } from "@/lib/monitoring/types";
import { MetricCard } from "./metric-card";
import { Clock, TrendingUp, CheckCircle2, XCircle, Zap } from "lucide-react";

interface PerformancePanelProps {
  metrics: PerformanceMetrics;
}

export function PerformancePanel({ metrics }: PerformancePanelProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Performance Metrics</h3>
      
      {/* Response Time Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Avg Response Time"
          value={`${metrics.responseTime.avg.toFixed(0)}ms`}
          icon={Clock}
          description="Average across all requests"
        />
        <MetricCard
          title="P95 Response Time"
          value={`${metrics.responseTime.p95.toFixed(0)}ms`}
          icon={TrendingUp}
          description="95th percentile"
        />
        <MetricCard
          title="P99 Response Time"
          value={`${metrics.responseTime.p99.toFixed(0)}ms`}
          icon={TrendingUp}
          description="99th percentile"
        />
        <MetricCard
          title="Cache Hit Rate"
          value={`${metrics.cache.hitRate.toFixed(1)}%`}
          icon={Zap}
          description={`${metrics.cache.totalHits} hits`}
          iconClassName="text-green-500"
        />
      </div>

      {/* Request Statistics */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Request Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{metrics.requests.total}</p>
                <p className="text-xs text-muted-foreground">Total Requests</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{metrics.requests.successful}</p>
                <p className="text-xs text-muted-foreground">Successful ({metrics.requests.successRate.toFixed(1)}%)</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/10">
                <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{metrics.requests.failed}</p>
                <p className="text-xs text-muted-foreground">Failed ({(100 - metrics.requests.successRate).toFixed(1)}%)</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cache Statistics */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Cache Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Hit Rate</span>
                <span className="text-sm font-bold">{metrics.cache.hitRate.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-secondary rounded-full h-2">
                <div
                  className="bg-green-500 h-2 rounded-full transition-all"
                  style={{ width: `${metrics.cache.hitRate}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">{metrics.cache.totalHits} hits</p>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Miss Rate</span>
                <span className="text-sm font-bold">{metrics.cache.missRate.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-secondary rounded-full h-2">
                <div
                  className="bg-yellow-500 h-2 rounded-full transition-all"
                  style={{ width: `${metrics.cache.missRate}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">{metrics.cache.totalMisses} misses</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
