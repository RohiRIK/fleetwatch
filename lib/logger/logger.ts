/**
 * Winston Logger Configuration
 * Structured logging with console and in-memory transports
 * Optimized for Vercel serverless environment (read-only filesystem)
 */

import winston from "winston";
import Transport from "winston-transport";
import { LogEntry, LogLevel } from "@/lib/monitoring/types";

// ============================================================================
// Configuration
// ============================================================================

const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  verbose: 4,
  debug: 5,
  silly: 6,
};

const IS_PRODUCTION = process.env.NODE_ENV === "production";
const IS_VERCEL = !!process.env.VERCEL;

// ============================================================================
// Log Storage (Redis-backed with in-memory fallback)
// ============================================================================

interface ILogStore {
  add(log: LogEntry): void | Promise<void>;
  query(options?: {
    level?: LogLevel[];
    search?: string;
    limit?: number;
    offset?: number;
  }): { logs: LogEntry[]; total: number } | Promise<{ logs: LogEntry[]; total: number }>;
  clear(): void | Promise<void>;
  getAll(): LogEntry[] | Promise<LogEntry[]>;
}

/**
 * Redis-backed log store for persistent logs across serverless workers
 */
class RedisLogStore implements ILogStore {
  private redisKey = "fleetwatch:logs";
  private maxLogs = 1000;
  private redis: any;

  constructor() {
    // Lazy load Redis to avoid circular dependencies
    this.initRedis();
  }

  private async initRedis() {
    try {
      const { redis } = await import("@/lib/redis/client");
      this.redis = redis;
    } catch (error) {
      console.error("[RedisLogStore] Failed to initialize Redis:", error);
    }
  }

  async add(log: LogEntry): Promise<void> {
    if (!this.redis) {
      await this.initRedis();
    }
    
    try {
      // Add log to Redis list (newest first)
      await this.redis.lpush(this.redisKey, JSON.stringify(log));
      // Trim to max logs
      await this.redis.ltrim(this.redisKey, 0, this.maxLogs - 1);
    } catch (error) {
      console.error("[RedisLogStore] Failed to add log:", error);
    }
  }

  async query(options: {
    level?: LogLevel[];
    search?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ logs: LogEntry[]; total: number }> {
    if (!this.redis) {
      await this.initRedis();
    }

    try {
      // Get all logs from Redis (already sorted newest first)
      const rawLogs = await this.redis.lrange(this.redisKey, 0, -1);
      let logs: LogEntry[] = rawLogs.map((log: string) => JSON.parse(log));

      // Filter by level
      if (options.level && options.level.length > 0) {
        logs = logs.filter((log) => options.level!.includes(log.level));
      }

      // Filter by search term
      if (options.search) {
        const searchLower = options.search.toLowerCase();
        logs = logs.filter(
          (log) =>
            log.message.toLowerCase().includes(searchLower) ||
            log.context?.toLowerCase().includes(searchLower) ||
            JSON.stringify(log.metadata).toLowerCase().includes(searchLower)
        );
      }

      const total = logs.length;
      const offset = options.offset || 0;
      const limit = options.limit || 100;

      return {
        logs: logs.slice(offset, offset + limit),
        total,
      };
    } catch (error) {
      console.error("[RedisLogStore] Failed to query logs:", error);
      return { logs: [], total: 0 };
    }
  }

  async clear(): Promise<void> {
    if (!this.redis) {
      await this.initRedis();
    }

    try {
      await this.redis.del(this.redisKey);
    } catch (error) {
      console.error("[RedisLogStore] Failed to clear logs:", error);
    }
  }

  async getAll(): Promise<LogEntry[]> {
    if (!this.redis) {
      await this.initRedis();
    }

    try {
      const rawLogs = await this.redis.lrange(this.redisKey, 0, -1);
      return rawLogs.map((log: string) => JSON.parse(log));
    } catch (error) {
      console.error("[RedisLogStore] Failed to get all logs:", error);
      return [];
    }
  }
}

/**
 * In-memory log store (fallback for Edge Runtime)
 */
class InMemoryLogStore implements ILogStore {
  private logs: LogEntry[] = [];
  private maxLogs: number;

  constructor(maxLogs = 1000) {
    this.maxLogs = maxLogs;
  }

  add(log: LogEntry) {
    this.logs.push(log);
    // Keep only the most recent logs
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }
  }

  query(options: {
    level?: LogLevel[];
    search?: string;
    limit?: number;
    offset?: number;
  } = {}): { logs: LogEntry[]; total: number } {
    let filtered = [...this.logs];

    // Filter by level
    if (options.level && options.level.length > 0) {
      filtered = filtered.filter((log) => options.level!.includes(log.level));
    }

    // Filter by search term
    if (options.search) {
      const searchLower = options.search.toLowerCase();
      filtered = filtered.filter(
        (log) =>
          log.message.toLowerCase().includes(searchLower) ||
          log.context?.toLowerCase().includes(searchLower) ||
          JSON.stringify(log.metadata).toLowerCase().includes(searchLower)
      );
    }

    // Sort by timestamp descending (newest first)
    filtered.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    const total = filtered.length;
    const offset = options.offset || 0;
    const limit = options.limit || 100;

    return {
      logs: filtered.slice(offset, offset + limit),
      total,
    };
  }

  clear() {
    this.logs = [];
  }

  getAll(): LogEntry[] {
    return [...this.logs];
  }
}

// Use Redis storage by default, fallback to in-memory for Edge Runtime
const USE_REDIS = process.env.REDIS_URL && !process.env.NEXT_RUNTIME;
const logStore: ILogStore = USE_REDIS ? new RedisLogStore() : new InMemoryLogStore(1000);

console.log(`[Logger] Using ${USE_REDIS ? 'Redis' : 'in-memory'} log storage`);

// ============================================================================
// Custom Winston Transport for In-Memory Storage
// ============================================================================

class InMemoryTransport extends Transport {
  constructor(opts?: Transport.TransportStreamOptions) {
    super(opts);
  }

  log(info: any, callback: () => void) {
    // Note: Due to Winston routing issues, logs are added directly in Logger class
    // This transport is kept for potential future use
    if (callback) {
      callback();
    }
  }
}

// ============================================================================
// Custom Format for Sensitive Data Redaction
// ============================================================================

const redactSensitiveData = winston.format((info) => {
  const sensitiveKeys = [
    "password",
    "token",
    "secret",
    "apiKey",
    "api_key",
    "authorization",
    "cookie",
    "session",
  ];

  const redact = (obj: Record<string, unknown>): Record<string, unknown> => {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (sensitiveKeys.some((k) => key.toLowerCase().includes(k))) {
        result[key] = "[REDACTED]";
      } else if (typeof value === "object" && value !== null) {
        result[key] = redact(value as Record<string, unknown>);
      } else {
        result[key] = value;
      }
    }
    return result;
  };

  return redact(info as Record<string, unknown>) as winston.Logform.TransformableInfo;
})();

// ============================================================================
// Winston Logger Instance
// ============================================================================

const logger = winston.createLogger({
  levels: LOG_LEVELS,
  level: IS_PRODUCTION ? "info" : "silly", // Use 'silly' to capture all levels
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.errors({ stack: true }),
    redactSensitiveData,
    winston.format.json()
  ),
  transports: [
    // Console transport (always enabled)
    new winston.transports.Console({
      level: IS_PRODUCTION ? "info" : "silly",
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(
          ({ timestamp, level, message, context, ...meta }) => {
            let log = `${timestamp} [${level}]`;
            if (context) log += ` [${context}]`;
            log += `: ${message}`;
            if (Object.keys(meta).length > 0) {
              log += ` ${JSON.stringify(meta)}`;
            }
            return log;
          }
        )
      ),
    }),

    // In-memory transport (for API access)
    new InMemoryTransport({ level: 'silly' }), // Explicitly set level
  ],
  exceptionHandlers: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
  ],
  rejectionHandlers: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
  ],
});

// ============================================================================
// Logger Interface
// ============================================================================

export interface LoggerContext {
  context?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

class Logger {
  private winston: winston.Logger;

  constructor(winstonInstance: winston.Logger) {
    this.winston = winstonInstance;
  }

  private log(
    level: LogLevel,
    message: string,
    options?: LoggerContext & { error?: Error }
  ) {
    const logData: Record<string, unknown> = {
      ...options,
    };

    if (options?.error) {
      logData.stack = options.error.stack;
      logData.errorName = options.error.name;
      logData.errorMessage = options.error.message;
    }

    // Add to logStore (supports both sync and async)
    const logEntry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      context: options?.context,
      userId: options?.userId,
      metadata: options?.metadata,
      stack: options?.error?.stack,
    };
    
    // Fire and forget - don't block on log storage
    const addResult = logStore.add(logEntry);
    if (addResult instanceof Promise) {
      addResult.catch((err) => console.error("[Logger] Failed to store log:", err));
    }

    // Still call Winston for console output
    this.winston.log(level, message, logData);
  }

  error(message: string, options?: LoggerContext & { error?: Error }) {
    this.log("error", message, options);
  }

  warn(message: string, options?: LoggerContext) {
    this.log("warn", message, options);
  }

  info(message: string, options?: LoggerContext) {
    this.log("info", message, options);
  }

  http(message: string, options?: LoggerContext) {
    this.log("http", message, options);
  }

  debug(message: string, options?: LoggerContext) {
    this.log("debug", message, options);
  }

  verbose(message: string, options?: LoggerContext) {
    this.log("verbose", message, options);
  }

  // Query logs from store (async-safe)
  async queryLogs(options?: {
    level?: LogLevel[];
    search?: string;
    limit?: number;
    offset?: number;
  }) {
    const result = logStore.query(options);
    return result instanceof Promise ? await result : result;
  }

  // Get all logs (async-safe)
  async getAllLogs(): Promise<LogEntry[]> {
    const result = logStore.getAll();
    return result instanceof Promise ? await result : result;
  }

  // Clear logs (async-safe)
  async clearLogs() {
    const result = logStore.clear();
    if (result instanceof Promise) {
      await result;
    }
  }
}

// ============================================================================
// Export Logger Instance
// ============================================================================

export const log = new Logger(logger);
export default log;

// Test that logger is working on startup
log.info("Logger initialized successfully", {
  context: "Logger",
  metadata: { environment: process.env.NODE_ENV },
});

// ============================================================================
// Production Warning
// ============================================================================

if (IS_VERCEL) {
  log.info("Logger initialized in Vercel environment (in-memory storage)", {
    context: "Logger",
  });
}
