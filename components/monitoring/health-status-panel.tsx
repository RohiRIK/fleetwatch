/**
 * Health Status Panel Component
 * Displays the health status of all system services
 */

"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SystemHealth, ServiceStatus } from "@/lib/monitoring/types";
import { Database, Activity, Cloud, AlertCircle, CheckCircle2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface HealthStatusPanelProps {
  health: SystemHealth;
}

function getStatusIcon(status: ServiceStatus) {
  switch (status) {
    case "healthy":
      return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    case "degraded":
      return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
    case "down":
      return <AlertCircle className="h-5 w-5 text-red-500" />;
    default:
      return <Activity className="h-5 w-5 text-gray-400" />;
  }
}

function getStatusBadge(status: ServiceStatus) {
  const variants: Record<ServiceStatus, "default" | "secondary" | "destructive" | "outline"> = {
    healthy: "default",
    degraded: "secondary",
    down: "destructive",
    unknown: "outline",
  };

  const labels: Record<ServiceStatus, string> = {
    healthy: "Healthy",
    degraded: "Degraded",
    down: "Down",
    unknown: "Unknown",
  };

  return (
    <Badge
      variant={variants[status]}
      className={cn(
        "font-medium",
        status === "healthy" && "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20",
        status === "degraded" && "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20",
        status === "down" && "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20"
      )}
    >
      {labels[status]}
    </Badge>
  );
}

export function HealthStatusPanel({ health }: HealthStatusPanelProps) {
  const services = [
    {
      name: "Database",
      icon: Database,
      health: health.services.database,
    },
    {
      name: "Redis Cache",
      icon: Activity,
      health: health.services.redis,
    },
    {
      name: "Microsoft Graph API",
      icon: Cloud,
      health: health.services.graphApi,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">System Health</CardTitle>
          {getStatusBadge(health.overall)}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {services.map((service) => (
            <div
              key={service.name}
              className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30 transition-colors hover:bg-muted/50"
            >
              <div className="flex items-center gap-3">
                {getStatusIcon(service.health.status)}
                <div>
                  <p className="font-medium text-sm">{service.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {service.health.message || "No details available"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {service.health.latency !== undefined && (
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Latency</p>
                    <p className="text-sm font-mono font-medium">{service.health.latency}ms</p>
                  </div>
                )}
                {getStatusBadge(service.health.status)}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
