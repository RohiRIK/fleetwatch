import { auth } from '@/lib/auth/config';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Enhanced Middleware with RBAC and Metrics Tracking
 * 1. Authentication check
 * 2. Role-based route protection
 * 3. Response time tracking
 * 4. Request metrics recording
 */

// Route access control configuration
const ROUTE_ACCESS = {
  // Public routes (no auth required)
  public: ['/login', '/admin-login'],
  
  // VIEWER routes (minimum role: VIEWER)
  viewer: ['/dashboard', '/inventory', '/devices', '/analytics', '/compliance'],
  
  // ADMIN routes (minimum role: ADMIN)
  admin: ['/admin/settings', '/admin/monitoring'],
  
  // SUPERADMIN routes (minimum role: SUPERADMIN)
  superadmin: ['/users', '/admin/users'],
} as const;

export default async function middleware(request: NextRequest) {
  const startTime = Date.now();
  const pathname = request.nextUrl.pathname;
  
  // Get auth session
  const session = await auth();
  
  // Continue with request
  let response: NextResponse;
  
  // Check if route is public
  if (isPublicRoute(pathname)) {
    response = NextResponse.next();
  } else if (!session?.user) {
    // Redirect to login if not authenticated
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    response = NextResponse.redirect(loginUrl);
  } else {
    // Check role-based access
    const hasAccess = await checkRouteAccess(pathname, session.user.email);
    
    if (!hasAccess) {
      // Forbidden - redirect to dashboard with error
      const dashboardUrl = new URL('/dashboard', request.url);
      dashboardUrl.searchParams.set('error', 'insufficient_permissions');
      response = NextResponse.redirect(dashboardUrl);
    } else {
      response = NextResponse.next();
    }
  }
  
  // Calculate response time
  const duration = Date.now() - startTime;
  
  // Add performance headers
  response.headers.set('X-Response-Time', `${duration}ms`);
  response.headers.set('X-Request-ID', crypto.randomUUID());
  
  // Record metrics asynchronously (fire and forget)
  recordMetrics(request, response, duration).catch(() => {
    // Silently ignore metrics errors
  });
  
  return response;
}

/**
 * Check if route is public (no auth required)
 */
function isPublicRoute(pathname: string): boolean {
  return ROUTE_ACCESS.public.some(route => pathname.startsWith(route));
}

/**
 * Check if user has access to route based on role
 */
async function checkRouteAccess(pathname: string, userEmail: string | null | undefined): Promise<boolean> {
  if (!userEmail) return false;
  
  // Import dynamically to avoid edge runtime issues
  const { getCurrentUserRole } = await import('@/lib/auth/rbac');
  const role = await getCurrentUserRole();
  
  // Check SUPERADMIN routes
  if (ROUTE_ACCESS.superadmin.some(route => pathname.startsWith(route))) {
    return role === 'SUPERADMIN';
  }
  
  // Check ADMIN routes
  if (ROUTE_ACCESS.admin.some(route => pathname.startsWith(route))) {
    return role === 'ADMIN' || role === 'SUPERADMIN';
  }
  
  // Check VIEWER routes (all authenticated users can access)
  if (ROUTE_ACCESS.viewer.some(route => pathname.startsWith(route))) {
    return true;
  }
  
  // Default: allow access for authenticated users
  return true;
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
     * - monitoring (Sentry tunnel)
     */
    '/((?!api/auth|_next/static|_next/image|favicon.ico|icon.png|monitoring).*)',
  ],
};
