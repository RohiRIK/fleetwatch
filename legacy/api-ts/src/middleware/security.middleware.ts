import { rateLimit } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import type { Request, Response, NextFunction } from 'express';
import { redisSessionService } from '../services/redis-session.service';

/**
 * Tiered Rate Limiting Configuration
 */

// 1. Global Rate Limit (Default for all routes)
export const globalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 1000, // Limit each IP to 1000 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
  store: redisSessionService.isAvailable() 
    ? new RedisStore({
        // @ts-expect-error - ioredis compatibility
        sendCommand: (...args: string[]) => redisSessionService.getClient()?.call(...args),
        prefix: 'rl:global:',
      })
    : undefined,
});

// 2. Auth Rate Limit (Login, SSO callbacks)
export const authRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 20, // Limit each IP to 20 auth attempts per hour
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts, please try again in an hour.' },
  store: redisSessionService.isAvailable()
    ? new RedisStore({
        // @ts-expect-error - ioredis compatibility
        sendCommand: (...args: string[]) => redisSessionService.getClient()?.call(...args),
        prefix: 'rl:auth:',
      })
    : undefined,
});

// 3. Ingest Rate Limit (Fetcher triggers)
export const ingestRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  limit: 10, // Limit ingest triggers to 10 per 5 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Ingestion rate limit exceeded.' },
  store: redisSessionService.isAvailable()
    ? new RedisStore({
        // @ts-expect-error - ioredis compatibility
        sendCommand: (...args: string[]) => redisSessionService.getClient()?.call(...args),
        prefix: 'rl:ingest:',
      })
    : undefined,
});

/**
 * PII Redaction Middleware
 * Sanitizes sensitive fields in logs and optionally in responses
 */
export const piiRedactionMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Check for includePII flag in query or headers
  const includePII = req.query.includePII === 'true' || req.headers['x-include-pii'] === 'true';
  
  // Attach flag to request for use in controllers/repositories
  (req as any).includePII = includePII;

  // Intercept response to perform redaction if includePII is false
  if (!includePII) {
    const originalJson = res.json;
    res.json = function (body: any) {
      if (body && typeof body === 'object') {
        const redactedBody = redactPII(body);
        return originalJson.call(this, redactedBody);
      }
      return originalJson.call(this, body);
    };
  }

  next();
};

/**
 * Recursive PII redaction helper
 */
function redactPII(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(item => redactPII(item));
  } else if (obj !== null && typeof obj === 'object') {
    const redacted: any = {};
    for (const [key, value] of Object.entries(obj)) {
      // List of PII fields to redact
      const piiFields = ['serialNumber'];
      
      if (piiFields.includes(key) && typeof value === 'string') {
        redacted[key] = maskString(value);
      } else {
        redacted[key] = redactPII(value);
      }
    }
    return redacted;
  }
  return obj;
}

/**
 * Mask string helper (e.g., "j.doe@company.com" -> "j***@company.com")
 */
function maskString(str: string): string {
  if (!str || str.length < 4) return '***';
  
  if (str.includes('@')) {
    const [local, domain] = str.split('@');
    return `${local.charAt(0)}***@${domain}`;
  }
  
  return `${str.substring(0, 2)}***${str.substring(str.length - 2)}`;
}
