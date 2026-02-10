/**
 * API route to trigger test logs for monitoring demo
 */
import { NextResponse } from 'next/server';
import { log } from '@/lib/logger/logger';

export async function GET() {
  log.info('🧪 Test endpoint accessed', {
    context: 'TestAPI',
    metadata: { 
      timestamp: new Date().toISOString(),
      userAgent: 'Browser'
    }
  });

  // Generate various log levels
  log.http('GET /api/devices - 200', {
    context: 'API',
    metadata: { 
      method: 'GET',
      path: '/api/devices',
      statusCode: 200,
      duration: 145,
      userId: 'admin-123'
    }
  });

  log.warn('⚠️ Cache miss detected for frequently accessed data', {
    context: 'Cache',
    metadata: { 
      key: 'device-list-filtered',
      hitRate: '45%',
      recommendation: 'Consider increasing TTL'
    }
  });

  log.error('🔴 Database connection timeout', {
    context: 'Database',
    error: new Error('Connection pool exhausted - timeout after 30s'),
    metadata: { 
      host: 'localhost',
      port: 5432,
      database: 'fleetwatch',
      activeConnections: 50,
      maxConnections: 50
    }
  });

  log.error('🔴 Microsoft Graph API rate limit exceeded', {
    context: 'GraphAPI',
    error: new Error('Rate limit: 429 Too Many Requests'),
    metadata: { 
      endpoint: '/v1.0/devices',
      retryAfter: 120,
      requestsInLastMinute: 150,
      limit: 100
    }
  });

  log.warn('⚠️ High memory usage detected', {
    context: 'System',
    metadata: { 
      usagePercent: 87,
      threshold: 80,
      totalMB: 4096,
      usedMB: 3563,
      action: 'Garbage collection triggered'
    }
  });

  log.info('✅ Device sync completed successfully', {
    context: 'DeviceSync',
    userId: 'system',
    metadata: { 
      devicesProcessed: 247,
      newDevices: 12,
      updatedDevices: 35,
      duration: 8234,
      nextSync: new Date(Date.now() + 3600000).toISOString()
    }
  });

  log.error('🔴 Email notification delivery failed', {
    context: 'Notifications',
    error: new Error('SMTP connection refused: Connection timeout'),
    metadata: { 
      recipient: 'admin@example.com',
      subject: 'Compliance Alert: 15 devices non-compliant',
      smtpServer: 'smtp.gmail.com',
      port: 587
    }
  });

  log.http('POST /api/users - 201', {
    context: 'API',
    metadata: { 
      method: 'POST',
      path: '/api/users',
      statusCode: 201,
      duration: 234,
      userId: 'admin-123',
      action: 'User created'
    }
  });

  log.info('🔐 User authentication successful', {
    context: 'Auth',
    userId: 'admin@device-inventory.local',
    metadata: { 
      email: 'admin@device-inventory.local',
      method: 'credentials',
      ipAddress: '192.168.1.100',
      userAgent: 'Mozilla/5.0'
    }
  });

  // Get all logs to return (now async)
  const allLogs = await log.getAllLogs();
  
  log.info(`📊 Generated test logs - Total logs in memory: ${allLogs.length}`, {
    context: 'TestAPI',
    metadata: {
      total: allLogs.length,
      errors: allLogs.filter(l => l.level === 'error').length,
      warnings: allLogs.filter(l => l.level === 'warn').length,
      info: allLogs.filter(l => l.level === 'info').length,
      http: allLogs.filter(l => l.level === 'http').length
    }
  });

  return NextResponse.json({
    success: true,
    message: 'Test logs generated successfully',
    logsGenerated: 11,
    totalLogsInMemory: allLogs.length,
    breakdown: {
      errors: allLogs.filter(l => l.level === 'error').length,
      warnings: allLogs.filter(l => l.level === 'warn').length,
      info: allLogs.filter(l => l.level === 'info').length,
      http: allLogs.filter(l => l.level === 'http').length
    },
    instructions: {
      step1: 'Go back to /admin/monitoring',
      step2: 'Click the Logs tab',
      step3: 'Click Refresh button',
      step4: 'You should see 10+ new logs with errors (red), warnings (yellow), and info (blue)'
    }
  });
}
