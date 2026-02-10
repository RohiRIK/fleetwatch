/**
 * Generate test logs including errors to verify logging system
 */
import log from '@/lib/logger/logger';

console.log('🧪 Generating test data for monitoring dashboard...\n');

// Generate various log levels
log.info('Application started successfully', { 
  context: 'TestData',
  metadata: { version: '1.0.0' }
});

log.http('GET /api/devices - 200', { 
  context: 'HTTP',
  metadata: { duration: 145, statusCode: 200, path: '/api/devices' }
});

log.http('POST /api/users - 201', { 
  context: 'HTTP',
  metadata: { duration: 234, statusCode: 201, path: '/api/users' }
});

log.warn('Cache miss for key: user-session-123', { 
  context: 'Cache',
  metadata: { key: 'user-session-123', ttl: 3600 }
});

log.error('Failed to sync device from Intune', { 
  context: 'DeviceSync',
  error: new Error('API rate limit exceeded'),
  metadata: { deviceId: 'device-456', retryCount: 3 }
});

log.error('Database query timeout', { 
  context: 'Database',
  error: new Error('Query exceeded 30s timeout'),
  metadata: { query: 'SELECT * FROM devices', timeout: 30000 }
});

log.http('GET /api/analytics - 500', { 
  context: 'HTTP',
  metadata: { duration: 5234, statusCode: 500, path: '/api/analytics', error: 'Internal server error' }
});

log.warn('High memory usage detected', { 
  context: 'System',
  metadata: { usagePercent: 87, threshold: 80 }
});

log.info('User logged in successfully', { 
  context: 'Auth',
  userId: 'user-789',
  metadata: { email: 'admin@example.com', method: 'credentials' }
});

log.error('Failed to send notification email', { 
  context: 'Notifications',
  error: new Error('SMTP connection refused'),
  metadata: { recipient: 'user@example.com', type: 'compliance-alert' }
});

setTimeout(async () => {
  const allLogs = await log.getAllLogs();
  console.log(`\n✅ Generated ${allLogs.length} log entries\n`);
  
  const errorLogs = allLogs.filter(l => l.level === 'error');
  const warnLogs = allLogs.filter(l => l.level === 'warn');
  const infoLogs = allLogs.filter(l => l.level === 'info');
  const httpLogs = allLogs.filter(l => l.level === 'http');
  
  console.log('📊 Log breakdown:');
  console.log(`  - Errors: ${errorLogs.length}`);
  console.log(`  - Warnings: ${warnLogs.length}`);
  console.log(`  - Info: ${infoLogs.length}`);
  console.log(`  - HTTP: ${httpLogs.length}`);
  console.log(`  - Total: ${allLogs.length}\n`);
  
  console.log('🔴 Error logs captured:');
  errorLogs.forEach((log, i) => {
    console.log(`  ${i + 1}. ${log.message} (${log.context})`);
    if (log.stack) console.log(`     Stack: ${log.stack.split('\n')[0]}`);
  });
  
  console.log('\n✅ Test data generated successfully!');
  console.log('🌐 Now open http://localhost:3000/admin/monitoring');
  console.log('📝 Click "Logs" tab to see all logs including errors\n');
  
  process.exit(0);
}, 1000);
