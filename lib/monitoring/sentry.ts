/**
 * Sentry Utilities
 * Wrapper functions for Sentry error tracking with graceful degradation
 */

import * as Sentry from "@sentry/nextjs";
import { SentryError, SentryIssuesResponse } from "@/lib/monitoring/types";

// ============================================================================
// Configuration
// ============================================================================

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;
const SENTRY_AUTH_TOKEN = process.env.SENTRY_AUTH_TOKEN;
const SENTRY_ORG = process.env.SENTRY_ORG;
const SENTRY_PROJECT = process.env.SENTRY_PROJECT;
const IS_SENTRY_ENABLED = !!SENTRY_DSN;

// ============================================================================
// Error Capture Functions
// ============================================================================

/**
 * Capture an error with Sentry
 * Falls back gracefully if Sentry is not configured
 */
export function captureError(
  error: Error,
  context?: {
    user?: { id: string; email?: string; username?: string };
    tags?: Record<string, string>;
    extra?: Record<string, unknown>;
    level?: Sentry.SeverityLevel;
  }
): string | null {
  if (!IS_SENTRY_ENABLED) {
    console.error("[Sentry Not Configured]", error);
    return null;
  }

  try {
    // Set user context
    if (context?.user) {
      Sentry.setUser(context.user);
    }

    // Set tags
    if (context?.tags) {
      Sentry.setTags(context.tags);
    }

    // Set extra context
    if (context?.extra) {
      Sentry.setExtras(context.extra);
    }

    // Capture exception
    const eventId = Sentry.captureException(error, {
      level: context?.level || "error",
    });

    return eventId;
  } catch (e) {
    console.error("[Sentry Capture Failed]", e);
    return null;
  }
}

/**
 * Capture a message with Sentry
 */
export function captureMessage(
  message: string,
  context?: {
    level?: Sentry.SeverityLevel;
    tags?: Record<string, string>;
    extra?: Record<string, unknown>;
  }
): string | null {
  if (!IS_SENTRY_ENABLED) {
    console.log("[Sentry Not Configured]", message);
    return null;
  }

  try {
    // Set tags
    if (context?.tags) {
      Sentry.setTags(context.tags);
    }

    // Set extra context
    if (context?.extra) {
      Sentry.setExtras(context.extra);
    }

    const eventId = Sentry.captureMessage(message, context?.level || "info");
    return eventId;
  } catch (e) {
    console.error("[Sentry Capture Failed]", e);
    return null;
  }
}

/**
 * Add breadcrumb for debugging
 */
export function addBreadcrumb(
  message: string,
  data?: {
    category?: string;
    level?: Sentry.SeverityLevel;
    data?: Record<string, unknown>;
  }
): void {
  if (!IS_SENTRY_ENABLED) return;

  try {
    Sentry.addBreadcrumb({
      message,
      category: data?.category || "custom",
      level: data?.level || "info",
      data: data?.data,
    });
  } catch (e) {
    console.error("[Sentry Breadcrumb Failed]", e);
  }
}

/**
 * Set user context
 */
export function setUser(user: {
  id: string;
  email?: string;
  username?: string;
}): void {
  if (!IS_SENTRY_ENABLED) return;

  try {
    Sentry.setUser(user);
  } catch (e) {
    console.error("[Sentry Set User Failed]", e);
  }
}

/**
 * Clear user context
 */
export function clearUser(): void {
  if (!IS_SENTRY_ENABLED) return;

  try {
    Sentry.setUser(null);
  } catch (e) {
    console.error("[Sentry Clear User Failed]", e);
  }
}

/**
 * Start a transaction for performance monitoring
 */
export function startTransaction(
  name: string,
  op: string
): ReturnType<typeof Sentry.startSpan> | null {
  if (!IS_SENTRY_ENABLED) return null;

  try {
    return Sentry.startSpan({
      name,
      op,
    }, (span) => span);
  } catch (e) {
    console.error("[Sentry Transaction Failed]", e);
    return null;
  }
}

// ============================================================================
// Sentry API Functions (for Dashboard)
// ============================================================================

/**
 * Fetch recent issues from Sentry API
 * Requires SENTRY_AUTH_TOKEN, SENTRY_ORG, and SENTRY_PROJECT
 */
export async function fetchSentryIssues(
  options: {
    limit?: number;
    status?: "resolved" | "unresolved" | "ignored";
    query?: string;
  } = {}
): Promise<SentryIssuesResponse> {
  if (!SENTRY_AUTH_TOKEN || !SENTRY_ORG || !SENTRY_PROJECT) {
    return {
      issues: [],
      total: 0,
      pageSize: 0,
      hasMore: false,
    };
  }

  const limit = options.limit || 25;
  const status = options.status || "unresolved";
  const query = options.query || "";

  try {
    const url = new URL(
      `https://sentry.io/api/0/projects/${SENTRY_ORG}/${SENTRY_PROJECT}/issues/`
    );

    url.searchParams.set("limit", limit.toString());
    url.searchParams.set("statsPeriod", "14d");

    if (status) {
      url.searchParams.set("query", `is:${status} ${query}`.trim());
    }

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${SENTRY_AUTH_TOKEN}`,
        "Content-Type": "application/json",
      },
      // Cache for 60 seconds to avoid rate limiting
      next: { revalidate: 60 },
    });

    if (!response.ok) {
      throw new Error(`Sentry API error: ${response.statusText}`);
    }

    const rawIssues = (await response.json()) as Array<{
      id: string;
      title: string;
      culprit?: string;
      level: "fatal" | "error" | "warning" | "info" | "debug";
      count: string;
      userCount: number;
      firstSeen: string;
      lastSeen: string;
      status: "resolved" | "unresolved" | "ignored";
      isUnhandled: boolean;
      metadata?: {
        type?: string;
        value?: string;
        filename?: string;
      };
    }>;

    const issues: SentryError[] = rawIssues.map((issue) => ({
      id: issue.id,
      title: issue.title,
      culprit: issue.culprit,
      level: issue.level,
      count: parseInt(issue.count, 10),
      userCount: issue.userCount,
      firstSeen: new Date(issue.firstSeen),
      lastSeen: new Date(issue.lastSeen),
      status: issue.status,
      isUnhandled: issue.isUnhandled,
      metadata: issue.metadata,
    }));

    return {
      issues,
      total: issues.length,
      pageSize: limit,
      hasMore: issues.length === limit,
    };
  } catch (error) {
    console.error("[Sentry API Fetch Failed]", error);
    return {
      issues: [],
      total: 0,
      pageSize: 0,
      hasMore: false,
    };
  }
}

/**
 * Check if Sentry is properly configured
 */
export function isSentryConfigured(): boolean {
  return IS_SENTRY_ENABLED;
}

/**
 * Get Sentry configuration status
 */
export function getSentryStatus(): {
  enabled: boolean;
  hasDSN: boolean;
  hasAuthToken: boolean;
  hasOrgAndProject: boolean;
} {
  return {
    enabled: IS_SENTRY_ENABLED,
    hasDSN: !!SENTRY_DSN,
    hasAuthToken: !!SENTRY_AUTH_TOKEN,
    hasOrgAndProject: !!(SENTRY_ORG && SENTRY_PROJECT),
  };
}

// ============================================================================
// Export Default Object
// ============================================================================

export default {
  captureError,
  captureMessage,
  addBreadcrumb,
  setUser,
  clearUser,
  startTransaction,
  fetchSentryIssues,
  isSentryConfigured,
  getSentryStatus,
};
