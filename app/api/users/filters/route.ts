import { NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { users } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Get distinct departments
    const departmentsQuery = await db
      .select({ value: users.department })
      .from(users)
      .where(sql`${users.department} IS NOT NULL`)
      .groupBy(users.department)
      .orderBy(users.department);
    
    const departments = departmentsQuery
      .map(d => d.value)
      .filter((d): d is string => d !== null);
    
    // Get distinct job titles
    const jobTitlesQuery = await db
      .select({ value: users.jobTitle })
      .from(users)
      .where(sql`${users.jobTitle} IS NOT NULL`)
      .groupBy(users.jobTitle)
      .orderBy(users.jobTitle);
    
    const jobTitles = jobTitlesQuery
      .map(j => j.value)
      .filter((j): j is string => j !== null);
    
    return NextResponse.json({
      departments,
      jobTitles,
    });
  } catch (error) {
    console.error('Error fetching user filters:', error);
    return NextResponse.json(
      { error: 'Failed to fetch filters' },
      { status: 500 }
    );
  }
}
