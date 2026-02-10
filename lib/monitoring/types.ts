/**
 * Monitoring & Logging Type Definitions
 * Centralized interfaces for monitoring system
 */

// ============================================================================
// System Health Types
// ============================================================================

export type ServiceStatus = "healthy" | "degraded" | "down" | "unknown";

export interface ServiceHealth {
  status: ServiceStatus;
  latency?: number; // milliseconds
  message?: string;
  lastChecked: Date;
  details?: Record<string, unknown>;
}

export interface SystemHealth {
  overall: ServiceStatus;
  services: {
    database: ServiceHealth;
    redis: ServiceHealth;
    graphApi: ServiceHealth;
  };
  timestamp: Date;
}

// ============================================================================
// Performance Metrics Types
// ============================================================================

export interface PerformanceMetrics {
  responseTime: {
    p50: number; // 50th percentile
    p95: number; // 95th percentile
    p99: number; // 99th percentile
    avg: number;
    min: number;
    max: number;
  };
  cache: {
    hitRate: number; // percentage
    missRate: number; // percentage
    totalHits: number;
    totalMisses: number;
  };
  requests: {
    total: number;
    successful: number;
    failed: number;
    successRate: number; // percentage
  };
  timestamp: Date;
}

export interface RequestMetric {
  path: string;
  method: string;
  statusCode: number;
  duration: number; // milliseconds
  timestamp: Date;
  userId?: string;
  error?: string;
}

// ============================================================================
// Sentry Error Types
// ============================================================================

export interface SentryError {
  id: string;
  title: string;
  culprit?: string;
  level: "fatal" | "error" | "warning" | "info" | "debug";
  count: number;
  userCount: number;
  firstSeen: Date;
  lastSeen: Date;
  status: "resolved" | "unresolved" | "ignored";
  isUnhandled: boolean;
  metadata?: {
    type?: string;
    value?: string;
    filename?: string;
  };
}

export interface SentryIssuesResponse {
  issues: SentryError[];
  total: number;
  pageSize: number;
  hasMore: boolean;
}

// ============================================================================
// Winston Log Types
// ============================================================================

export type LogLevel = "error" | "warn" | "info" | "http" | "verbose" | "debug" | "silly";

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
  stack?: string;
}

export interface LogQuery {
  level?: LogLevel[];
  search?: string;
  startDate?: Date;
  endDate?: Date;
  context?: string;
  limit?: number;
  offset?: number;
}

export interface LogQueryResult {
  logs: LogEntry[];
  total: number;
  hasMore: boolean;
}

// ============================================================================
// Sync Status Types
// ============================================================================

export interface SyncStatus {
  lastDeviceSync: Date | null;
  lastUserSync: Date | null;
  deviceSyncStatus: "success" | "failed" | "in_progress" | "never_run";
  userSyncStatus: "success" | "failed" | "in_progress" | "never_run";
  deviceSyncError?: string;
  userSyncError?: string;
  nextScheduledSync?: Date;
}

// ============================================================================
// Active Users Types
// ============================================================================

export interface ActiveUser {
  id: string;
  email: string;
  name: string;
  role: string;
  lastActivity: Date;
  sessionCount: number;
}

export interface ActiveUsersStats {
  currentlyActive: number;
  last24Hours: number;
  last7Days: number;
  users: ActiveUser[];
}

// ============================================================================
// Monitoring Dashboard Types
// ============================================================================

export interface MonitoringDashboardData {
  health: SystemHealth;
  metrics: PerformanceMetrics;
  errors: SentryIssuesResponse;
  logs: LogQueryResult;
  syncStatus: SyncStatus;
  activeUsers: ActiveUsersStats;
  timestamp: Date;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: Date;
}

// ============================================================================
// Metrics Collector Configuration
// ============================================================================

export interface MetricsCollectorConfig {
  enabled: boolean;
  storageType: "memory" | "redis";
  retentionMinutes: number;
  maxSamples: number;
}
