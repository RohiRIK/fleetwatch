import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { devices } from '@/lib/db/schema';
import { and, or, like, eq, gte, lte, desc, asc, isNull, sql, count } from 'drizzle-orm';

/**
 * API endpoint to fetch devices with advanced filtering, search, sort, and pagination
 * 
 * Query parameters:
 * - search: Search device name, serial number, or user
 * - os: Filter by operating system (Windows, macOS, iOS, Android)
 * - isCompliant: Filter by compliance status (true/false)
 * - isEncrypted: Filter by encryption status (true/false)
 * - manufacturer: Filter by manufacturer
 * - chassisType: Filter by device type
 * - lastSyncFrom: Filter devices synced after this date
 * - lastSyncTo: Filter devices synced before this date
 * - sortBy: Sort field (deviceName, lastSyncAt, manufacturer, osVersion, etc.)
 * - sortOrder: Sort direction (asc/desc)
 * - page: Page number (default: 1)
 * - pageSize: Items per page (default: 20, max: 100)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const search = searchParams.get('search') || '';
    const os = searchParams.get('os') || '';
    const isCompliantParam = searchParams.get('isCompliant');
    const isEncryptedParam = searchParams.get('isEncrypted');
    const manufacturer = searchParams.get('manufacturer') || '';
    const chassisType = searchParams.get('chassisType') || '';
    const lastSyncFrom = searchParams.get('lastSyncFrom') || '';
    const lastSyncTo = searchParams.get('lastSyncTo') || '';
    const sortBy = searchParams.get('sortBy') || 'lastSyncAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '20')));

    // Build WHERE conditions
    const conditions = [];

    // Search across multiple fields
    if (search) {
      conditions.push(
        or(
          like(devices.deviceName, `%${search}%`),
          like(devices.serialNumber, `%${search}%`),
          like(devices.userPrincipalName, `%${search}%`),
          like(devices.userDisplayName, `%${search}%`),
          like(devices.manufacturer, `%${search}%`),
          like(devices.model, `%${search}%`)
        )
      );
    }

    // Filter by OS
    if (os) {
      conditions.push(eq(devices.operatingSystem, os));
    }

    // Filter by compliance
    if (isCompliantParam !== null) {
      conditions.push(eq(devices.isCompliant, isCompliantParam === 'true'));
    }

    // Filter by encryption
    if (isEncryptedParam !== null) {
      conditions.push(eq(devices.isEncrypted, isEncryptedParam === 'true'));
    }

    // Filter by manufacturer
    if (manufacturer) {
      conditions.push(eq(devices.manufacturer, manufacturer));
    }

    // Filter by chassis type
    if (chassisType) {
      conditions.push(eq(devices.chassisType, chassisType));
    }

    // Filter by last sync date range
    if (lastSyncFrom) {
      conditions.push(gte(devices.lastSyncAt, new Date(lastSyncFrom)));
    }
    if (lastSyncTo) {
      conditions.push(lte(devices.lastSyncAt, new Date(lastSyncTo)));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Determine sort column and direction
    const sortColumn = (devices as any)[sortBy] || devices.lastSyncAt;
    const orderFn = sortOrder === 'asc' ? asc : desc;

    // Get total count for pagination
    const [{ totalCount }] = await db
      .select({ totalCount: count() })
      .from(devices)
      .where(whereClause);

    // Fetch paginated devices
    const allDevices = await db
      .select({
        id: devices.id,
        azureId: devices.azureId,
        deviceName: devices.deviceName,
        serialNumber: devices.serialNumber,
        manufacturer: devices.manufacturer,
        model: devices.model,
        operatingSystem: devices.operatingSystem,
        osVersion: devices.osVersion,
        isCompliant: devices.isCompliant,
        complianceState: devices.complianceState,
        isEncrypted: devices.isEncrypted,
        isSupervised: devices.isSupervised,
        userPrincipalName: devices.userPrincipalName,
        userDisplayName: devices.userDisplayName,
        userEmail: devices.userEmail,
        userDepartment: devices.userDepartment,
        storageTotal: devices.storageTotal,
        storageFree: devices.storageFree,
        memoryTotal: devices.memoryTotal,
        chassisType: devices.chassisType,
        ipAddressV4: devices.ipAddressV4,
        wifiMac: devices.wifiMac,
        ethernetMac: devices.ethernetMac,
        joinType: devices.joinType,
        enrollmentType: devices.enrollmentType,
        managedDeviceOwnerType: devices.managedDeviceOwnerType,
        dataQuality: devices.dataQuality,
        ingestionMetadata: devices.ingestionMetadata,
        lastSyncAt: devices.lastSyncAt,
        enrolledAt: devices.enrolledAt,
        createdAt: devices.createdAt,
        updatedAt: devices.updatedAt,
      })
      .from(devices)
      .where(whereClause)
      .orderBy(orderFn(sortColumn))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / pageSize);

    return NextResponse.json({
      success: true,
      devices: allDevices,
      pagination: {
        page,
        pageSize,
        totalCount,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
      filters: {
        search,
        os,
        isCompliant: isCompliantParam,
        isEncrypted: isEncryptedParam,
        manufacturer,
        chassisType,
        lastSyncFrom,
        lastSyncTo,
      },
      sort: {
        sortBy,
        sortOrder,
      },
    });
  } catch (error: any) {
    console.error('[API] Failed to fetch devices:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
