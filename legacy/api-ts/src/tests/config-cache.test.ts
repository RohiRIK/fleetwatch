import { describe, it, expect, beforeEach, afterEach, spyOn } from 'bun:test';
import { configCache } from '../utils/config-cache';
import { promises as fs } from 'fs';
import path from 'path';

describe('ConfigCache', () => {
  const envPath = path.join(process.cwd(), '.env.test');

  beforeEach(async () => {
    configCache.setEnvPath(envPath);
    if (await fs.exists(envPath)) {
      await fs.unlink(envPath);
    }
  });

  afterEach(async () => {
    if (await fs.exists(envPath)) {
      await fs.unlink(envPath);
    }
    // Reset path
    configCache.setEnvPath(path.join(process.cwd(), '.env'));
  });

  it('should load variables from .env file', async () => {
    const testContent = 'TEST_KEY=test_value\nANOTHER_KEY=another_value';
    await fs.writeFile(envPath, testContent);
    
    const success = await configCache.loadFromDisk();
    expect(success).toBe(true);
    expect(configCache.get('TEST_KEY')).toBe('test_value');
    expect(configCache.get('ANOTHER_KEY')).toBe('another_value');
  });

  it('should handle missing .env file gracefully', async () => {
    const success = await configCache.loadFromDisk();
    expect(success).toBe(false);
  });

  it('should implement Parse Safety and retain old config on invalid syntax', async () => {
    // 1. Load valid config
    await fs.writeFile(envPath, 'VALID_KEY=original');
    await configCache.loadFromDisk();
    expect(configCache.get('VALID_KEY')).toBe('original');

    // 2. Write invalid config (junk data that isn't KEY=VALUE)
    await fs.writeFile(envPath, 'THIS_IS_NOT_A_VALID_LINE'); 
    const success = await configCache.loadFromDisk();
    
    expect(success).toBe(false);
    expect(configCache.get('VALID_KEY')).toBe('original'); // Should retain old value
  });

  it('should support default values', () => {
    expect(configCache.get('NON_EXISTENT_KEY', 'default')).toBe('default');
  });

  it('should prioritize cache over process.env', async () => {
    process.env.OVERRIDE_TEST = 'original';
    const testContent = 'OVERRIDE_TEST=overridden';
    await fs.writeFile(envPath, testContent);
    
    await configCache.loadFromDisk();
    expect(configCache.get('OVERRIDE_TEST')).toBe('overridden');
    
    delete process.env.OVERRIDE_TEST;
  });
});
