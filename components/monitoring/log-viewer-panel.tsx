/**
 * Log Viewer Panel Component
 * Displays Winston logs with filtering
 */

"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { LogEntry, LogLevel } from "@/lib/monitoring/types";
import { Search, AlertCircle, AlertTriangle, Info, Bug, FileText } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface LogViewerPanelProps {
  logs: LogEntry[];
  onSearch?: (search: string) => void;
}

function getLevelIcon(level: LogLevel) {
  switch (level) {
    case "error":
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    case "warn":
      return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    case "info":
      return <Info className="h-4 w-4 text-blue-500" />;
    case "debug":
      return <Bug className="h-4 w-4 text-purple-500" />;
    default:
      return <FileText className="h-4 w-4 text-gray-500" />;
  }
}

function getLevelBadge(level: LogLevel) {
  const styles: Record<LogLevel, string> = {
    error: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20",
    warn: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20",
    info: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
    http: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20",
    verbose: "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20",
    debug: "bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/20",
    silly: "bg-pink-500/10 text-pink-700 dark:text-pink-400 border-pink-500/20",
  };

  return (
    <Badge variant="outline" className={cn("font-medium uppercase text-[10px]", styles[level])}>
      {level}
    </Badge>
  );
}

export function LogViewerPanel({ logs, onSearch }: LogViewerPanelProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    onSearch?.(value);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <CardTitle className="text-lg font-semibold">System Logs ({logs.length})</CardTitle>
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search logs…"
              className="pl-8"
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
              autoComplete="off"
              aria-label="Search logs"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="rounded-full bg-secondary p-3 mb-3">
              <FileText className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">No logs found</p>
            <p className="text-xs text-muted-foreground mt-1">
              {searchTerm ? "Try adjusting your search" : "No logs available yet"}
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {logs.map((log, index) => (
              <div
                key={`${log.timestamp}-${index}`}
                className="p-3 rounded-lg border border-border bg-muted/20 hover:bg-muted/40 transition-colors font-mono text-xs"
              >
                <div className="flex items-start gap-2 mb-1">
                  {getLevelIcon(log.level)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {getLevelBadge(log.level)}
                      {log.context && (
                        <Badge variant="outline" className="text-[10px] font-medium">
                          {log.context}
                        </Badge>
                      )}
                      <span className="text-[10px] text-muted-foreground">
                        {new Intl.DateTimeFormat('en-US', {
                          dateStyle: 'short',
                          timeStyle: 'medium'
                        }).format(new Date(log.timestamp))}
                      </span>
                    </div>
                    <p className="text-sm break-words">{log.message}</p>
                    {log.metadata && Object.keys(log.metadata).length > 0 && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                          View metadata
                        </summary>
                        <pre className="mt-2 p-2 rounded bg-secondary/50 overflow-x-auto text-[10px]">
                          {JSON.stringify(log.metadata, null, 2)}
                        </pre>
                      </details>
                    )}
                    {log.stack && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-xs text-red-600 dark:text-red-400 hover:underline">
                          View stack trace
                        </summary>
                        <pre className="mt-2 p-2 rounded bg-red-500/5 overflow-x-auto text-[10px] text-red-600 dark:text-red-400">
                          {log.stack}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
