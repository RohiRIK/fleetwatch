'use server';

import { z } from 'zod';
import { createServerAction } from '../base';
import { getManagedDevices, testGraphConnection as testConnection } from '@/lib/graph/client';

/**
 * Test Graph API connection
 * Verifies credentials and permissions
 */
const testConnectionSchema = z.object({});

export const testGraphConnection = createServerAction(
  testConnectionSchema,
  async () => {
    const result = await testConnection();
    return result;
  },
  { requireAuth: true }
);

/**
 * Fetch sample devices from Intune
 * Used to verify Graph API access to device management
 */
const fetchDevicesSchema = z.object({
  count: z.number().min(1).max(20).default(5),
});

export const fetchSampleDevices = createServerAction(
  fetchDevicesSchema,
  async (input) => {
    const devices = await getManagedDevices({
      top: input.count,
      select: [
        'id',
        'deviceName',
        'operatingSystem',
        'osVersion',
        'complianceState',
        'manufacturer',
        'model',
        'lastSyncDateTime',
      ],
    });

    return {
      success: true,
      count: devices.length,
      devices: devices.map((device: any) => ({
        id: device.id,
        name: device.deviceName,
        os: device.operatingSystem,
        osVersion: device.osVersion,
        compliant: device.complianceState === 'compliant',
        manufacturer: device.manufacturer,
        model: device.model,
        lastSync: device.lastSyncDateTime,
      })),
    };
  },
  { requireAuth: true }
);
