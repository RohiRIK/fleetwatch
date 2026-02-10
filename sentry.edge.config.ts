/**
 * Sentry Edge Runtime Configuration
 * For middleware and edge functions
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
      // Remove sensitive headers
      if (event.request?.headers) {
        delete event.request.headers["authorization"];
        delete event.request.headers["cookie"];
        delete event.request.headers["x-api-key"];
      }
      
      return event;
    },
  });
} else {
  console.warn("[Sentry] DSN not configured, error tracking disabled");
}
