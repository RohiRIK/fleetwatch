import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { users, devices } from '@/lib/db/schema';
import { eq, or, ilike, sql, desc, asc } from 'drizzle-orm';
import { protectRouteWithRole } from '@/lib/auth/api-rbac';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Protect route - require SUPERADMIN role to view users
  const { error } = await protectRouteWithRole('SUPERADMIN');
  if (error) return error;

  try {
    const searchParams = request.nextUrl.searchParams;
    
    // Pagination
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const offset = (page - 1) * pageSize;
    
    // Filters
    const search = searchParams.get('search') || '';
    const department = searchParams.get('department') || '';
    const jobTitle = searchParams.get('jobTitle') || '';
    const hasDevices = searchParams.get('hasDevices'); // 'true', 'false', or null
    
    // Sorting
    const sortBy = searchParams.get('sortBy') || 'name';
    const sortOrder = (searchParams.get('sortOrder') || 'asc') as 'asc' | 'desc';
    
    // Build WHERE conditions
    const conditions = [];
    
    // Search: name, email, displayName
    if (search) {
      conditions.push(
        or(
          ilike(users.name, `%${search}%`),
          ilike(users.email, `%${search}%`),
          ilike(users.displayName, `%${search}%`)
        )
      );
    }
    
    // Department filter
    if (department) {
      conditions.push(eq(users.department, department));
    }
    
    // Job title filter
    if (jobTitle) {
      conditions.push(eq(users.jobTitle, jobTitle));
    }
    
    // Build base query with all chained methods
    const queryBuilder = db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        displayName: users.displayName,
        jobTitle: users.jobTitle,
        department: users.department,
        azureId: users.azureId,
        image: users.image,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
        deviceCount: sql<number>`count(${devices.id})::int`,
      })
      .from(users)
      .leftJoin(devices, eq(users.id, devices.userId))
      .groupBy(users.id);
    
    // Apply WHERE conditions
    const queryWithWhere = conditions.length > 0
      ? queryBuilder.where(sql`${sql.join(conditions, sql` AND `)}`)
      : queryBuilder;
    
    // Apply sorting
    const sortColumn = sortBy === 'email' ? users.email :
                       sortBy === 'department' ? users.department :
                       sortBy === 'jobTitle' ? users.jobTitle :
                       sortBy === 'deviceCount' ? sql`count(${devices.id})` :
                       users.name;
    
    const queryWithSort = queryWithWhere.orderBy(
      sortOrder === 'desc' ? desc(sortColumn) : asc(sortColumn)
    );
    
    // Apply pagination and execute
    const result = await queryWithSort.limit(pageSize).offset(offset);
    
    // Get total count
    const totalUsers = await db
      .select({ count: sql<number>`count(DISTINCT ${users.id})::int` })
      .from(users)
      .leftJoin(devices, eq(users.id, devices.userId));
    
    const totalCount = totalUsers[0]?.count || 0;
    
    // Filter by hasDevices if specified
    let filteredResult = result;
    if (hasDevices === 'true') {
      filteredResult = result.filter(user => user.deviceCount > 0);
    } else if (hasDevices === 'false') {
      filteredResult = result.filter(user => user.deviceCount === 0);
    }
    
    return NextResponse.json({
      users: filteredResult,
      pagination: {
        page,
        pageSize,
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
      },
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}
