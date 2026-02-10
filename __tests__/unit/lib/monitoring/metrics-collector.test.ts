/**
 * Metrics Collector Tests
 * Tests for performance metrics collection
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { metricsCollector } from '@/lib/monitoring/metrics-collector';

describe('MetricsCollector', () => {
  beforeEach(async () => {
    // Clear metrics before each test
    await metricsCollector.clearMetrics();
  });

  describe('Request Metrics', () => {
    it('should record request metrics', async () => {
      await metricsCollector.recordRequest({
        path: '/api/test',
        method: 'GET',
        statusCode: 200,
        duration: 150,
        timestamp: new Date(),
      });

      const metrics = await metricsCollector.getMetrics();
      expect(metrics.requests.total).toBe(1);
      expect(metrics.requests.successful).toBe(1);
      expect(metrics.requests.failed).toBe(0);
    });

    it('should calculate response time percentiles', async () => {
      // Record various response times
      const durations = [50, 100, 150, 200, 250, 300, 350, 400, 450, 500];
      
      for (const duration of durations) {
        await metricsCollector.recordRequest({
          path: '/api/test',
          method: 'GET',
          statusCode: 200,
          duration,
          timestamp: new Date(),
        });
      }

      const metrics = await metricsCollector.getMetrics();
      
      expect(metrics.responseTime.p50).toBeGreaterThan(0);
      expect(metrics.responseTime.p95).toBeGreaterThan(metrics.responseTime.p50);
      expect(metrics.responseTime.p99).toBeGreaterThan(metrics.responseTime.p95);
      expect(metrics.responseTime.min).toBe(50);
      expect(metrics.responseTime.max).toBe(500);
    });

    it('should track successful vs failed requests', async () => {
      await metricsCollector.recordRequest({
        path: '/api/test',
        method: 'GET',
        statusCode: 200,
        duration: 100,
        timestamp: new Date(),
      });

      await metricsCollector.recordRequest({
        path: '/api/test',
        method: 'GET',
        statusCode: 500,
        duration: 50,
        timestamp: new Date(),
      });

      await metricsCollector.recordRequest({
        path: '/api/test',
        method: 'GET',
        statusCode: 404,
        duration: 25,
        timestamp: new Date(),
      });

      const metrics = await metricsCollector.getMetrics();
      
      expect(metrics.requests.total).toBe(3);
      expect(metrics.requests.successful).toBe(1);
      expect(metrics.requests.failed).toBe(2);
      expect(metrics.requests.successRate).toBeCloseTo(33.33, 1);
    });
  });

  describe('Cache Metrics', () => {
    it('should record cache hits', async () => {
      await metricsCollector.recordCacheHit();
      await metricsCollector.recordCacheHit();
      await metricsCollector.recordCacheHit();

      const metrics = await metricsCollector.getMetrics();
      
      expect(metrics.cache.totalHits).toBe(3);
      expect(metrics.cache.totalMisses).toBe(0);
      expect(metrics.cache.hitRate).toBe(100);
    });

    it('should record cache misses', async () => {
      await metricsCollector.recordCacheMiss();
      await metricsCollector.recordCacheMiss();

      const metrics = await metricsCollector.getMetrics();
      
      expect(metrics.cache.totalHits).toBe(0);
      expect(metrics.cache.totalMisses).toBe(2);
      expect(metrics.cache.missRate).toBe(100);
    });

    it('should calculate cache hit rate', async () => {
      await metricsCollector.recordCacheHit();
      await metricsCollector.recordCacheHit();
      await metricsCollector.recordCacheHit();
      await metricsCollector.recordCacheMiss();
      await metricsCollector.recordCacheMiss();

      const metrics = await metricsCollector.getMetrics();
      
      expect(metrics.cache.totalHits).toBe(3);
      expect(metrics.cache.totalMisses).toBe(2);
      expect(metrics.cache.hitRate).toBe(60); // 3/5 = 60%
      expect(metrics.cache.missRate).toBe(40); // 2/5 = 40%
    });
  });

  describe('Metrics Calculation', () => {
    it('should handle empty metrics', async () => {
      const metrics = await metricsCollector.getMetrics();
      
      expect(metrics.requests.total).toBe(0);
      expect(metrics.requests.successful).toBe(0);
      expect(metrics.requests.failed).toBe(0);
      expect(metrics.responseTime.avg).toBe(0);
      expect(metrics.cache.hitRate).toBe(0);
    });

    it('should include timestamp', async () => {
      const beforeTime = new Date();
      const metrics = await metricsCollector.getMetrics();
      const afterTime = new Date();
      
      expect(metrics.timestamp.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(metrics.timestamp.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });
  });

  describe('Configuration', () => {
    it('should return configuration', () => {
      const config = metricsCollector.getConfig();
      
      expect(config.enabled).toBeDefined();
      expect(config.storageType).toBeDefined();
      expect(config.retentionMinutes).toBeDefined();
      expect(config.maxSamples).toBeDefined();
    });
  });
});
