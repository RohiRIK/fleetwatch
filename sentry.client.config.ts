/**
 * Sentry Client Configuration
 * Initialized on the browser/client side
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
    
    // Session Replay
    replaysSessionSampleRate: 0.1, // 10% of sessions
    replaysOnErrorSampleRate: 1.0, // 100% of sessions with errors
    
    // Integrations (updated for Sentry v10+)
    integrations: [
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    
    // Debug mode (only in development)
    debug: ENVIRONMENT === "development",
    
    // Filter out sensitive data
    beforeSend(event, hint) {
      // Remove sensitive headers
      if (event.request?.headers) {
        delete event.request.headers["authorization"];
        delete event.request.headers["cookie"];
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
      // Browser extensions
      "top.GLOBALS",
      "chrome-extension://",
      "moz-extension://",
      // Network errors
      "NetworkError",
      "Failed to fetch",
      // React hydration errors (expected in dev)
      "Hydration failed",
      "There was an error while hydrating",
    ],
  });
} else {
  console.warn("[Sentry] DSN not configured, error tracking disabled");
}
