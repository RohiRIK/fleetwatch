import { auth } from '@/lib/auth/config';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Enhanced Middleware with Metrics Tracking
 * 1. Tracks response times for all requests
 * 2. Records request metrics (method, path, status, duration)
 * 3. Integrates with NextAuth for authentication
 */

export default async function middleware(request: NextRequest) {
  const startTime = Date.now();
  
  // Get auth session
  const session = await auth();
  
  // Continue with request
  let response: NextResponse;
  
  if (!session?.user) {
    // Redirect to login if not authenticated
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', request.nextUrl.pathname);
    response = NextResponse.redirect(loginUrl);
  } else {
    response = NextResponse.next();
  }
  
  // Calculate response time
  const duration = Date.now() - startTime;
  
  // Add performance headers
  response.headers.set('X-Response-Time', `${duration}ms`);
  response.headers.set('X-Request-ID', crypto.randomUUID());
  
  // Record metrics asynchronously (fire and forget)
  recordMetrics(request, response, duration).catch((error) => {
    // Silently ignore metrics errors - they're not critical
  });
  
  return response;
}

async function recordMetrics(
  request: NextRequest,
  response: NextResponse,
  duration: number
) {
  try {
    // Dynamically import to avoid bundling issues in edge runtime
    const { metricsCollector } = await import('@/lib/monitoring/metrics-collector');
    const { getSession } = await import('@/lib/auth/session');
    
    const session = await getSession();
    
    // Ensure all values are properly defined before recording
    const path = request.nextUrl?.pathname || '/';
    const method = request.method || 'GET';
    const statusCode = response.status || 200;
    const userId = session?.user?.id || undefined;
    
    await metricsCollector.recordRequest({
      path,
      method,
      statusCode,
      duration,
      timestamp: new Date(),
      userId,
    });
  } catch (error) {
    // Silently fail - metrics are not critical
    // Don't log to avoid console spam in Edge Runtime
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (NextAuth.js auth endpoints)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - login (login page)
     * - admin-login (emergency admin login page)
     * - monitoring (Sentry tunnel)
     */
    '/((?!api/auth|_next/static|_next/image|favicon.ico|login|admin-login|monitoring).*)',
  ],
};
