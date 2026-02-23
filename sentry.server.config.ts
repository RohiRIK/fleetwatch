/**
 * Sentry Server Configuration
 * Initialized on the Node.js server side
 */

import * as Sentry from "@sentry/nextjs";

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;
const ENVIRONMENT = process.env.NODE_ENV || "development";

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    
    // Environment
    environment: ENVIRONMENT,
    
    // Adjust sampling rate for production
    tracesSampleRate: ENVIRONMENT === "production" ? 0.1 : 1.0,
    
    // Debug mode (only in development)
    debug: ENVIRONMENT === "development",
    
    // Filter out sensitive data
    beforeSend(event, hint) {
      // Remove sensitive environment variables
      if (event.contexts?.runtime?.env) {
        const env = event.contexts.runtime.env as Record<string, unknown>;
        delete env.DATABASE_URL;
        delete env.REDIS_URL;
        delete env.NEXTAUTH_SECRET;
        delete env.ENTRA_CLIENT_SECRET;
        delete env.ADMIN_PASSWORD_HASH;
        delete env.CRON_SECRET;
      }
      
      // Remove sensitive headers
      if (event.request?.headers) {
        delete event.request.headers["authorization"];
        delete event.request.headers["cookie"];
        delete event.request.headers["x-api-key"];
      }
      
      // Remove sensitive query params
      if (event.request?.query_string && typeof event.request.query_string === 'string') {
        event.request.query_string = event.request.query_string
          .replace(/token=[^&]+/gi, "token=[REDACTED]")
          .replace(/apiKey=[^&]+/gi, "apiKey=[REDACTED]")
          .replace(/secret=[^&]+/gi, "secret=[REDACTED]");
      }
      
      return event;
    },
    
    // Ignore certain errors
    ignoreErrors: [
      // Database connection errors (logged separately)
      "Connection terminated unexpectedly",
      "ECONNREFUSED",
      // Redis errors (logged separately)
      "ETIMEDOUT",
      "ENOTFOUND",
    ],
  });
} else {
  console.warn("[Sentry] DSN not configured, error tracking disabled");
}
