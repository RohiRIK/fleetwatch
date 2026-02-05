// Swagger/OpenAPI Configuration
import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Device Inventory API',
      version: '2.0.0',
      description: `
TypeScript API for device and user management with OpenSearch backend.

## Features
- Device and user queries with advanced filtering
- Analytics and dashboard data aggregations
- Data ingestion endpoints (authenticated)
- Real-time statistics and trends

## Authentication
Ingest endpoints require Bearer token authentication using the INGEST_SECRET environment variable.
      `,
      contact: {
        name: 'API Support',
        url: 'https://github.com/your-org/device-inventory'
      }
    },
    servers: [
      {
        url: 'http://localhost:3001',
        description: 'Development server'
      },
      {
        url: 'http://api-ts:3001',
        description: 'Docker internal'
      },
      {
        url: 'https://api.yourdomain.com',
        description: 'Production server'
      }
    ],
    tags: [
      {
        name: 'Health',
        description: 'Health check and system status endpoints'
      },
      {
        name: 'Devices',
        description: 'Device query and management endpoints'
      },
      {
        name: 'Users',
        description: 'User query endpoints'
      },
      {
        name: 'Licenses',
        description: 'License usage and optimization endpoints'
      },
      {
        name: 'Analytics',
        description: 'Dashboard and analytics aggregation endpoints'
      },
      {
        name: 'Ingest',
        description: 'Data ingestion endpoints (requires authentication)'
      },
      {
        name: 'Configurations',
        description: 'Configuration profile management'
      },
      {
        name: 'Logs',
        description: 'System log retrieval'
      },
      {
        name: 'Scheduler',
        description: 'Fetcher job scheduling and control'
      },
      {
        name: 'Settings',
        description: 'System configuration and Azure App setup'
      },
      {
        name: 'Setup',
        description: 'Initial setup and OAuth helper configuration'
      },
      {
        name: 'Conditional Access',
        description: 'Entra ID security policy monitoring'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'Token',
          description: 'Enter your INGEST_SECRET token'
        }
      },
      schemas: {
        Device: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Intune device ID' },
            deviceName: { type: 'string', description: 'Device name' },
            manufacturer: { type: 'string', description: 'Device manufacturer' },
            model: { type: 'string', description: 'Device model' },
            operatingSystem: { type: 'string', enum: ['Windows', 'macOS', 'iOS', 'Android'], description: 'Operating system' },
            osVersion: { type: 'string', description: 'OS version' },
            serialNumber: { type: 'string', description: 'Serial number' },
            userPrincipalName: { type: 'string', description: 'User email/UPN' },
            userDisplayName: { type: 'string', description: 'User display name' },
            lastSyncDateTime: { type: 'string', format: 'date-time', description: 'Last sync timestamp' },
            enrolledDateTime: { type: 'string', format: 'date-time', description: 'Enrollment timestamp' },
            isCompliant: { type: 'boolean', description: 'Compliance status' },
            isEncrypted: { type: 'boolean', description: 'Encryption status' },
            isSupervised: { type: 'boolean', description: 'Supervised status' },
            managedDeviceOwnerType: { type: 'string', description: 'Owner type (company/personal)' }
          }
        },
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Entra ID user ID' },
            userPrincipalName: { type: 'string', description: 'User email/UPN' },
            displayName: { type: 'string', description: 'Display name' },
            givenName: { type: 'string', description: 'First name' },
            surname: { type: 'string', description: 'Last name' },
            jobTitle: { type: 'string', description: 'Job title' },
            department: { type: 'string', description: 'Department' },
            officeLocation: { type: 'string', description: 'Office location' },
            city: { type: 'string', description: 'City' },
            country: { type: 'string', description: 'Country' },
            accountEnabled: { type: 'boolean', description: 'Account enabled status' }
          }
        },
        License: {
          type: 'object',
          properties: {
            skuId: { type: 'string', description: 'SKU ID' },
            skuPartNumber: { type: 'string', description: 'SKU Part Number' },
            displayName: { type: 'string', description: 'License Name' },
            total: { type: 'number', description: 'Total licenses purchased' },
            assigned: { type: 'number', description: 'Assigned licenses' },
            unused: { type: 'number', description: 'Unused licenses' },
            utilizationRate: { type: 'number', description: 'Utilization percentage' },
            utilizationStatus: { type: 'string', enum: ['optimal', 'acceptable', 'poor'], description: 'Utilization status' },
            monthlyCost: { type: 'number', description: 'Estimated monthly cost' },
            monthlyWaste: { type: 'number', description: 'Estimated monthly waste' },
            annualWaste: { type: 'number', description: 'Estimated annual waste' }
          }
        },
        LogEntry: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            timestamp: { type: 'string', format: 'date-time' },
            level: { type: 'string', enum: ['info', 'warning', 'error', 'success'] },
            source: { type: 'string' },
            action: { type: 'string' },
            message: { type: 'string' },
            metadata: { type: 'object' }
          }
        },
        ConditionalAccessPolicy: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Policy GUID' },
            displayName: { type: 'string', description: 'Policy Name' },
            state: { type: 'string', enum: ['enabled', 'disabled', 'enabledForReportingButNotEnforced'] },
            createdDateTime: { type: 'string', format: 'date-time' },
            modifiedDateTime: { type: 'string', format: 'date-time' },
            conditions: { type: 'object' },
            grantControls: { type: 'object' },
            sessionControls: { type: 'object' }
          }
        },
        SchedulerStatus: {
          type: 'object',
          properties: {
            enabled: { type: 'boolean' },
            schedule: { type: 'string', example: '0 */6 * * *' },
            nextRun: { type: 'string', format: 'date-time' },
            lastRun: { type: 'string', format: 'date-time' },
            isRunning: { type: 'boolean' }
          }
        },
        PaginatedDevices: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: {
              type: 'array',
              items: { $ref: '#/components/schemas/Device' }
            },
            pagination: {
              type: 'object',
              properties: {
                page: { type: 'number', example: 1 },
                limit: { type: 'number', example: 50 },
                total: { type: 'number', example: 2247 },
                pages: { type: 'number', example: 45 }
              }
            }
          }
        },
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: { type: 'string', description: 'Error type' },
            message: { type: 'string', description: 'Error message' },
            details: { type: 'object', description: 'Additional error details' }
          }
        }
      }
    },
    security: []
  },
  apis: ['./src/routes/*.ts', './src/index.ts']
};

export const swaggerSpec = swaggerJsdoc(options);
