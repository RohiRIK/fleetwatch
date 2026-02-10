/**
 * Error List Panel Component
 * Displays recent errors from Sentry
 */

"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SentryError } from "@/lib/monitoring/types";
import { AlertCircle, AlertTriangle, Info, Bug, Skull } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface ErrorListPanelProps {
  errors: SentryError[];
}

function getLevelIcon(level: SentryError["level"]) {
  switch (level) {
    case "fatal":
      return <Skull className="h-4 w-4 text-red-600" />;
    case "error":
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    case "warning":
      return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    case "info":
      return <Info className="h-4 w-4 text-blue-500" />;
    default:
      return <Bug className="h-4 w-4 text-gray-500" />;
  }
}

function getLevelBadge(level: SentryError["level"]) {
  const styles: Record<SentryError["level"], string> = {
    fatal: "bg-red-600/10 text-red-700 dark:text-red-400 border-red-500/20",
    error: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20",
    warning: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20",
    info: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
    debug: "bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/20",
  };

  return (
    <Badge variant="outline" className={cn("font-medium capitalize", styles[level])}>
      {level}
    </Badge>
  );
}

export function ErrorListPanel({ errors }: ErrorListPanelProps) {
  if (errors.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Recent Errors</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="rounded-full bg-green-500/10 p-3 mb-3">
              <AlertCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <p className="text-sm font-medium">No errors found</p>
            <p className="text-xs text-muted-foreground mt-1">
              Sentry has not reported any errors recently
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">
          Recent Errors ({errors.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {errors.map((error) => (
            <button
              key={error.id}
              className="w-full text-left p-4 rounded-lg border border-border bg-muted/30 transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              aria-label={`View error details: ${error.title}`}
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-start gap-2 flex-1">
                  {getLevelIcon(error.level)}
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium truncate">{error.title}</h4>
                    {error.culprit && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {error.culprit}
                      </p>
                    )}
                  </div>
                </div>
                {getLevelBadge(error.level)}
              </div>

              <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
                <div className="flex items-center gap-1">
                  <span className="font-medium">{new Intl.NumberFormat().format(error.count)}</span>
                  <span>events</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="font-medium">{new Intl.NumberFormat().format(error.userCount)}</span>
                  <span>users</span>
                </div>
                <div className="flex items-center gap-1">
                  <span>Last seen {formatDistanceToNow(error.lastSeen, { addSuffix: true })}</span>
                </div>
              </div>

              {error.metadata && (
                <div className="mt-2 p-2 rounded bg-secondary/50 text-xs font-mono">
                  {error.metadata.type && <div className="text-muted-foreground">{error.metadata.type}</div>}
                  {error.metadata.value && <div className="truncate">{error.metadata.value}</div>}
                </div>
              )}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
