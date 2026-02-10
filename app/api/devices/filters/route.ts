import { NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { devices } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';

/**
 * API endpoint to get unique filter values for dropdowns
 * Returns distinct values for OS, manufacturer, chassis type, etc.
 */
export async function GET() {
  try {
    // Get distinct operating systems
    const osResults = await db
      .selectDistinct({ value: devices.operatingSystem })
      .from(devices)
      .where(sql`${devices.operatingSystem} IS NOT NULL`)
      .orderBy(devices.operatingSystem);

    // Get distinct manufacturers
    const manufacturerResults = await db
      .selectDistinct({ value: devices.manufacturer })
      .from(devices)
      .where(sql`${devices.manufacturer} IS NOT NULL`)
      .orderBy(devices.manufacturer);

    // Get distinct chassis types
    const chassisResults = await db
      .selectDistinct({ value: devices.chassisType })
      .from(devices)
      .where(sql`${devices.chassisType} IS NOT NULL`)
      .orderBy(devices.chassisType);

    // Get distinct compliance states
    const complianceResults = await db
      .selectDistinct({ value: devices.complianceState })
      .from(devices)
      .where(sql`${devices.complianceState} IS NOT NULL`)
      .orderBy(devices.complianceState);

    return NextResponse.json({
      success: true,
      filters: {
        operatingSystems: osResults.map(r => r.value).filter(Boolean),
        manufacturers: manufacturerResults.map(r => r.value).filter(Boolean),
        chassisTypes: chassisResults.map(r => r.value).filter(Boolean),
        complianceStates: complianceResults.map(r => r.value).filter(Boolean),
        // Static options
        complianceOptions: [
          { label: 'Compliant', value: 'true' },
          { label: 'Non-Compliant', value: 'false' },
        ],
        encryptionOptions: [
          { label: 'Encrypted', value: 'true' },
          { label: 'Not Encrypted', value: 'false' },
        ],
      },
    });
  } catch (error: any) {
    console.error('[API] Failed to fetch filter options:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
