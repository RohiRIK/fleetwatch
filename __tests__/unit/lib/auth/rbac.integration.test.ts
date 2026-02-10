/**
 * RBAC Integration Tests
 * Tests role-based access control system
 */

import { describe, it, expect } from 'vitest';
import { PERMISSIONS } from '@/lib/auth/rbac';

describe('RBAC - Permissions Matrix', () => {
  it('should have correct permissions for VIEWER', () => {
    expect(PERMISSIONS.VIEWER).toEqual({
      view_devices: true,
      view_users: true,
      view_analytics: true,
      view_compliance: true,
      export_data: false,
      manage_devices: false,
      manage_users: false,
      manage_settings: false,
      trigger_sync: false,
      view_monitoring: false,
    });
  });

  it('should have correct permissions for ADMIN', () => {
    expect(PERMISSIONS.ADMIN).toEqual({
      view_devices: true,
      view_users: true,
      view_analytics: true,
      view_compliance: true,
      export_data: true,
      manage_devices: true,
      manage_users: false, // Cannot manage users
      manage_settings: true,
      trigger_sync: true,
      view_monitoring: true,
    });
  });

  it('should have correct permissions for SUPERADMIN', () => {
    expect(PERMISSIONS.SUPERADMIN).toEqual({
      view_devices: true,
      view_users: true,
      view_analytics: true,
      view_compliance: true,
      export_data: true,
      manage_devices: true,
      manage_users: true, // Can manage users
      manage_settings: true,
      trigger_sync: true,
      view_monitoring: true,
    });
  });

  it('should follow role hierarchy: VIEWER < ADMIN < SUPERADMIN', () => {
    // Count permissions for each role
    const viewerPerms = Object.values(PERMISSIONS.VIEWER).filter(Boolean).length;
    const adminPerms = Object.values(PERMISSIONS.ADMIN).filter(Boolean).length;
    const superadminPerms = Object.values(PERMISSIONS.SUPERADMIN).filter(Boolean).length;

    // Higher roles should have more permissions
    expect(adminPerms).toBeGreaterThan(viewerPerms);
    expect(superadminPerms).toBeGreaterThan(adminPerms);
  });

  it('VIEWER should only have read permissions', () => {
    const viewer = PERMISSIONS.VIEWER;
    
    // Should have view permissions
    expect(viewer.view_devices).toBe(true);
    expect(viewer.view_users).toBe(true);
    expect(viewer.view_analytics).toBe(true);
    expect(viewer.view_compliance).toBe(true);
    
    // Should NOT have write/manage permissions
    expect(viewer.export_data).toBe(false);
    expect(viewer.manage_devices).toBe(false);
    expect(viewer.manage_users).toBe(false);
    expect(viewer.manage_settings).toBe(false);
    expect(viewer.trigger_sync).toBe(false);
    expect(viewer.view_monitoring).toBe(false);
  });

  it('ADMIN should have management permissions but not user management', () => {
    const admin = PERMISSIONS.ADMIN;
    
    // Should have all view permissions
    expect(admin.view_devices).toBe(true);
    expect(admin.view_users).toBe(true);
    expect(admin.view_analytics).toBe(true);
    expect(admin.view_compliance).toBe(true);
    expect(admin.view_monitoring).toBe(true);
    
    // Should have device management
    expect(admin.manage_devices).toBe(true);
    expect(admin.manage_settings).toBe(true);
    expect(admin.trigger_sync).toBe(true);
    expect(admin.export_data).toBe(true);
    
    // Should NOT have user management
    expect(admin.manage_users).toBe(false);
  });

  it('SUPERADMIN should have all permissions', () => {
    const superadmin = PERMISSIONS.SUPERADMIN;
    
    // All permissions should be true
    Object.values(superadmin).forEach(permission => {
      expect(permission).toBe(true);
    });
  });

  it('should have consistent permission keys across all roles', () => {
    const viewerKeys = Object.keys(PERMISSIONS.VIEWER).sort();
    const adminKeys = Object.keys(PERMISSIONS.ADMIN).sort();
    const superadminKeys = Object.keys(PERMISSIONS.SUPERADMIN).sort();

    expect(viewerKeys).toEqual(adminKeys);
    expect(adminKeys).toEqual(superadminKeys);
  });

  it('should define specific permission types', () => {
    const expectedPermissions = [
      'view_devices',
      'view_users',
      'view_analytics',
      'view_compliance',
      'export_data',
      'manage_devices',
      'manage_users',
      'manage_settings',
      'trigger_sync',
      'view_monitoring',
    ];

    const viewerKeys = Object.keys(PERMISSIONS.VIEWER).sort();
    expect(viewerKeys).toEqual(expectedPermissions.sort());
  });
});
