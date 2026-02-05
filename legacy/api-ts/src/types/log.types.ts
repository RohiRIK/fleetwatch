/**
 * Log Type Categories
 */
export enum LogType {
  SYSTEM = 'system',
  USER = 'user',
  ENTRA = 'entra'
}

/**
 * System Logs Severities
 */
export type LogSeverity = 'info' | 'warning' | 'error' | 'success' | 'debug';

/**
 * Base interface for all log entries
 */
export interface BaseLogEntry {
  id: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

/**
 * System Logs (Server-side)
 */
export interface SystemLogEntry extends BaseLogEntry {
  severity: LogSeverity;
  service: string;
  message: string;
  action: string;
  source: string;
  user?: string;
}

/**
 * User Activity Logs (Client-side)
 */
export interface UserActivityLogEntry extends BaseLogEntry {
  user_upn: string;
  action: string;
  resource_id?: string;
  ip_address?: string;
  user_agent?: string;
}

/**
 * Entra ID Logs (External)
 */
export interface EntraLogEntry extends BaseLogEntry {
  category: 'SignIn' | 'Audit';
  user_upn: string;
  app_name?: string;
  ip_address?: string;
  status: 'Success' | 'Failure';
  result_description?: string;
  details?: Record<string, any>;
}

/**
 * Unified Log Entry Type
 */
export type LogEntry = SystemLogEntry | UserActivityLogEntry | EntraLogEntry;
