/**
 * Logger Tests
 * Tests for Winston logger functionality
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { log } from '@/lib/logger/logger';

describe('Logger', () => {
  beforeEach(() => {
    // Clear logs before each test
    log.clearLogs();
  });

  describe('Logging Functions', () => {
    it('should log error messages', () => {
      log.error('Test error message', { context: 'Test' });
      
      const logs = log.getAllLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe('error');
      expect(logs[0].message).toBe('Test error message');
      expect(logs[0].context).toBe('Test');
    });

    it('should log warn messages', () => {
      log.warn('Test warning', { context: 'Test' });
      
      const logs = log.getAllLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe('warn');
      expect(logs[0].message).toBe('Test warning');
    });

    it('should log info messages', () => {
      log.info('Test info', { context: 'Test' });
      
      const logs = log.getAllLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe('info');
      expect(logs[0].message).toBe('Test info');
    });

    it('should log http messages', () => {
      log.http('GET /api/test - 200', { context: 'HTTP' });
      
      const logs = log.getAllLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe('http');
    });

    it('should include error stack trace', () => {
      const error = new Error('Test error');
      log.error('Error occurred', { context: 'Test', error });
      
      const logs = log.getAllLogs();
      expect(logs[0].stack).toBeDefined();
      expect(logs[0].stack).toContain('Test error');
    });
  });

  describe('Log Querying', () => {
    beforeEach(() => {
      log.error('Error 1', { context: 'Test' });
      log.warn('Warning 1', { context: 'Test' });
      log.info('Info 1', { context: 'Test' });
      log.debug('Debug 1', { context: 'Test' });
    });

    it('should query logs by level', () => {
      const result = log.queryLogs({ level: ['error'] });
      
      expect(result.logs).toHaveLength(1);
      expect(result.logs[0].level).toBe('error');
      expect(result.total).toBe(1);
    });

    it('should query logs by multiple levels', () => {
      const result = log.queryLogs({ level: ['error', 'warn'] });
      
      expect(result.logs).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should search logs by message content', () => {
      log.info('Special message about database', { context: 'DB' });
      
      const result = log.queryLogs({ search: 'database' });
      
      expect(result.logs).toHaveLength(1);
      expect(result.logs[0].message).toContain('database');
    });

    it('should limit query results', () => {
      const result = log.queryLogs({ limit: 2 });
      
      expect(result.logs).toHaveLength(2);
      expect(result.total).toBeGreaterThanOrEqual(4);
    });

    it('should offset query results', () => {
      const result = log.queryLogs({ offset: 2, limit: 2 });
      
      expect(result.logs).toHaveLength(2);
    });

    it('should return logs in descending order by timestamp', () => {
      const result = log.queryLogs();
      
      if (result.logs.length > 1) {
        const firstTimestamp = new Date(result.logs[0].timestamp).getTime();
        const secondTimestamp = new Date(result.logs[1].timestamp).getTime();
        expect(firstTimestamp).toBeGreaterThanOrEqual(secondTimestamp);
      }
    });
  });

  describe('Log Storage', () => {
    it('should store logs with metadata', () => {
      log.info('Test with metadata', {
        context: 'Test',
        metadata: { userId: '123', action: 'login' },
      });
      
      const logs = log.getAllLogs();
      expect(logs[0].metadata).toEqual({ userId: '123', action: 'login' });
    });

    it('should clear all logs', () => {
      log.error('Error 1', { context: 'Test' });
      log.info('Info 1', { context: 'Test' });
      
      expect(log.getAllLogs()).toHaveLength(2);
      
      log.clearLogs();
      
      expect(log.getAllLogs()).toHaveLength(0);
    });

    it('should maintain maximum log count', () => {
      // Create more than 1000 logs (the max)
      for (let i = 0; i < 1100; i++) {
        log.info(`Log ${i}`, { context: 'Test' });
      }
      
      const logs = log.getAllLogs();
      expect(logs.length).toBeLessThanOrEqual(1000);
    });
  });
});
