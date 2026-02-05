/**
 * Permission Test Endpoints Mapping
 * 
 * Maps Microsoft Graph permission IDs to lightweight test API calls.
 */

export const PERMISSION_TEST_ENDPOINTS: Record<string, { name: string, endpoint: string, method: string }> = {
  // Device Management (Intune)
  '2f51be20-0bb4-4fed-bf7b-db946066c75e': { 
    name: 'DeviceManagementManagedDevices.Read.All',
    endpoint: '/v1.0/deviceManagement/managedDevices?$top=1',
    method: 'GET'
  },
  'dc377aa6-52d8-4e23-b271-2a7ae04cedf3': { 
    name: 'DeviceManagementConfiguration.Read.All',
    endpoint: '/v1.0/deviceManagement/deviceConfigurations?$top=1',
    method: 'GET'
  },
  '7a6ee1e7-141e-4cec-ae74-d9db155731ff': { 
    name: 'DeviceManagementApps.Read.All',
    endpoint: '/v1.0/deviceManagement/mobileApps?$top=1',
    method: 'GET'
  },
  '58ca0d9a-1575-47e1-a3cb-007ef2e4583b': { 
    name: 'DeviceManagementRBAC.Read.All',
    endpoint: '/v1.0/deviceManagement/roleDefinitions?$top=1',
    method: 'GET'
  },
  '06a5fe6d-c49d-46a7-b082-56b1b14103c7': { 
    name: 'DeviceManagementServiceConfig.Read.All',
    endpoint: '/v1.0/deviceManagement/softwareUpdateStatusSummary',
    method: 'GET'
  },

  // Users & Groups
  'df021288-bdef-4463-88db-98f22de89214': { 
    name: 'User.Read.All',
    endpoint: '/v1.0/users?$top=1',
    method: 'GET'
  },
  '62a82d76-70ea-41e2-9197-370581804d09': { 
    name: 'Group.Read.All',
    endpoint: '/v1.0/groups?$top=1',
    method: 'GET'
  },
  'ba05cce5-bca2-232b-ced3-0c3dd22c76c0': { 
    name: 'User.Read.All', // Legacy/Duplicate check
    endpoint: '/v1.0/users?$top=1',
    method: 'GET'
  },

  // Devices (Entra ID)
  '7438b122-aefc-4978-80ed-43db9fcc7715': { 
    name: 'Device.Read.All',
    endpoint: '/v1.0/devices?$top=1',
    method: 'GET'
  },

  // Organization
  '498476ce-e0fe-48b0-b801-37ba7e2685c6': { 
    name: 'Organization.Read.All',
    endpoint: '/v1.0/organization',
    method: 'GET'
  },

  // Directory
  '7ab1d382-f21e-4acd-a863-ba3e13f7da61': { 
    name: 'Directory.Read.All',
    endpoint: '/v1.0/domains?$top=1',
    method: 'GET'
  },

  // Reports & Logs
  '024fd8d1-330d-4050-9c74-b5b3ef6c1101': { 
    name: 'Reports.Read.All',
    endpoint: '/v1.0/reports/getOffice365ActiveUserDetail(period=\'D7\')?$top=1',
    method: 'GET'
  },
  '5524481e-56c4-4ff4-86f4-2926778c0ace': { 
    name: 'AuditLog.Read.All',
    endpoint: '/v1.0/auditLogs/directoryAudits?$top=1',
    method: 'GET'
  }
};