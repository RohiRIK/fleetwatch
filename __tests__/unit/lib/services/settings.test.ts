/**
 * Settings Service Tests
 * TDD for application settings management
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import type { Setting, NewSetting } from '@/lib/db/schema';
import type { SettingKey, SettingValue, SyncMode } from '@/lib/types/settings';

// ============================================================================
// Mocks
// ============================================================================

vi.mock('@/lib/db/drizzle', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('@/lib/db/schema', () => ({
  settings: {
    id: 'id',
    category: 'category',
    key: 'key',
    value: 'value',
  },
}));

// ============================================================================
// Test Data
// ============================================================================

const mockSetting: Setting = {
  id: 'sync.schedule',
  category: 'sync',
  key: 'schedule',
  value: '0 */6 * * *',
  encrypted: false,
  description: 'Cron expression for sync schedule',
  defaultValue: '0 */6 * * *',
  updatedBy: 'user-123',
  updatedAt: new Date(),
  createdAt: new Date(),
};

// ============================================================================
// Tests
// ============================================================================

describe('Settings Service', () => {
  let dbSelectMock: Mock;
  let dbInsertMock: Mock;
  let dbUpdateMock: Mock;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    const { db } = await import('@/lib/db/drizzle');
    dbSelectMock = db.select as Mock;
    dbInsertMock = db.insert as Mock;
    dbUpdateMock = db.update as Mock;
    
    setupDefaultMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function setupDefaultMocks() {
    // Default: Return empty settings
    dbSelectMock.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    });
    
    // Default: Insert succeeds
    dbInsertMock.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([mockSetting]),
      }),
    });
    
    // Default: Update succeeds
    dbUpdateMock.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockSetting]),
        }),
      }),
    });
  }

  // ==========================================================================
  // getSettings() Tests
  // ==========================================================================

  describe('getSettings()', () => {
    it('should fetch all settings when no category provided', async () => {
      // ARRANGE
      const mockSettings = [mockSetting];
      dbSelectMock.mockReturnValue({
        from: vi.fn().mockResolvedValue(mockSettings),
      });
      
      // ACT
      const { getSettings } = await import('@/lib/services/settings');
      const result = await getSettings();
      
      // ASSERT
      expect(result).toEqual(mockSettings);
      expect(dbSelectMock).toHaveBeenCalled();
    });

    it('should fetch settings filtered by category', async () => {
      // ARRANGE
      const syncSettings = [mockSetting];
      dbSelectMock.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(syncSettings),
        }),
      });
      
      // ACT
      const { getSettings } = await import('@/lib/services/settings');
      const result = await getSettings('sync');
      
      // ASSERT
      expect(result).toEqual(syncSettings);
    });

    it('should return empty array when no settings exist', async () => {
      // ARRANGE
      dbSelectMock.mockReturnValue({
        from: vi.fn().mockResolvedValue([]),
      });
      
      // ACT
      const { getSettings } = await import('@/lib/services/settings');
      const result = await getSettings();
      
      // ASSERT
      expect(result).toEqual([]);
    });
  });

  // ==========================================================================
  // getSetting() Tests
  // ==========================================================================

  describe('getSetting()', () => {
    it('should fetch a single setting by key', async () => {
      // ARRANGE
      dbSelectMock.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockSetting]),
        }),
      });
      
      // ACT
      const { getSetting } = await import('@/lib/services/settings');
      const result = await getSetting('sync.schedule');
      
      // ASSERT
      expect(result).toEqual(mockSetting);
    });

    it('should return null when setting does not exist', async () => {
      // ARRANGE
      dbSelectMock.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });
      
      // ACT
      const { getSetting } = await import('@/lib/services/settings');
      const result = await getSetting('nonexistent.key');
      
      // ASSERT
      expect(result).toBeNull();
    });

    it('should return default value when setting not in database', async () => {
      // ARRANGE
      dbSelectMock.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });
      
      // ACT
      const { getSettingValue } = await import('@/lib/services/settings');
      const result = await getSettingValue('sync.enabled');
      
      // ASSERT
      expect(result).toBe(true); // Default value
    });
  });

  // ==========================================================================
  // updateSetting() Tests
  // ==========================================================================

  describe('updateSetting()', () => {
    it('should update an existing setting', async () => {
      // ARRANGE
      const updatedSetting = { ...mockSetting, value: '0 */12 * * *' };
      dbSelectMock.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockSetting]),
        }),
      });
      dbUpdateMock.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updatedSetting]),
          }),
        }),
      });
      
      // ACT
      const { updateSetting } = await import('@/lib/services/settings');
      const result = await updateSetting('sync.schedule', '0 */12 * * *', 'user-123');
      
      // ASSERT
      expect(result).toEqual(updatedSetting);
    });

    it('should create setting if it does not exist', async () => {
      // ARRANGE
      dbSelectMock.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });
      
      // ACT
      const { updateSetting } = await import('@/lib/services/settings');
      const result = await updateSetting('sync.schedule', '0 */12 * * *', 'user-123');
      
      // ASSERT
      expect(dbInsertMock).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should validate cron expression for sync.schedule', async () => {
      // ARRANGE - invalid cron expression
      
      // ACT & ASSERT
      const { updateSetting } = await import('@/lib/services/settings');
      await expect(
        updateSetting('sync.schedule', 'invalid-cron', 'user-123')
      ).rejects.toThrow('Invalid cron expression');
    });

    it('should validate sync mode enum', async () => {
      // ACT & ASSERT
      const { updateSetting } = await import('@/lib/services/settings');
      await expect(
        updateSetting('sync.mode', 'invalid-mode', 'user-123')
      ).rejects.toThrow('Invalid sync mode');
    });

    it('should validate email format for notification recipients', async () => {
      // ACT & ASSERT
      const { updateSetting } = await import('@/lib/services/settings');
      await expect(
        updateSetting('notifications.email.recipients', ['invalid-email'], 'user-123')
      ).rejects.toThrow('Invalid email format');
    });

    it('should validate URL format for webhook', async () => {
      // ACT & ASSERT
      const { updateSetting } = await import('@/lib/services/settings');
      await expect(
        updateSetting('notifications.webhook.url', 'not-a-url', 'user-123')
      ).rejects.toThrow('Invalid URL format');
    });

    it('should validate number range for compliance threshold', async () => {
      // ACT & ASSERT
      const { updateSetting } = await import('@/lib/services/settings');
      await expect(
        updateSetting('notifications.thresholds.compliance', 150, 'user-123')
      ).rejects.toThrow('Value must be between 0 and 100');
    });
  });

  // ==========================================================================
  // resetSetting() Tests
  // ==========================================================================

  describe('resetSetting()', () => {
    it('should reset setting to default value', async () => {
      // ARRANGE
      const defaultSetting = { ...mockSetting, value: '0 */6 * * *' };
      dbUpdateMock.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([defaultSetting]),
          }),
        }),
      });
      
      // ACT
      const { resetSetting } = await import('@/lib/services/settings');
      const result = await resetSetting('sync.schedule');
      
      // ASSERT
      expect(result.value).toBe('0 */6 * * *');
    });
  });

  // ==========================================================================
  // Encryption Tests
  // ==========================================================================

  describe('Encryption', () => {
    it('should encrypt sensitive values (webhook URL)', async () => {
      // ACT
      const { encryptSensitiveValue } = await import('@/lib/services/settings');
      const encrypted = encryptSensitiveValue('https://webhook.example.com');
      
      // ASSERT
      expect(encrypted).not.toBe('https://webhook.example.com');
      expect(encrypted.length).toBeGreaterThan(0);
    });

    it('should decrypt encrypted values', async () => {
      // ARRANGE
      const { encryptSensitiveValue, decryptSensitiveValue } = await import('@/lib/services/settings');
      const original = 'https://webhook.example.com';
      const encrypted = encryptSensitiveValue(original);
      
      // ACT
      const decrypted = decryptSensitiveValue(encrypted);
      
      // ASSERT
      expect(decrypted).toBe(original);
    });

    it('should handle empty strings', async () => {
      // ACT
      const { encryptSensitiveValue, decryptSensitiveValue } = await import('@/lib/services/settings');
      const encrypted = encryptSensitiveValue('');
      const decrypted = decryptSensitiveValue(encrypted);
      
      // ASSERT
      expect(decrypted).toBe('');
    });
  });

  // ==========================================================================
  // Validation Helper Tests
  // ==========================================================================

  describe('validateSettingValue()', () => {
    it('should validate boolean values', async () => {
      // ACT
      const { validateSettingValue } = await import('@/lib/services/settings');
      const result = validateSettingValue('sync.enabled', true);
      
      // ASSERT
      expect(result).toBe(true);
    });

    it('should reject invalid type for boolean setting', async () => {
      // ACT & ASSERT
      const { validateSettingValue } = await import('@/lib/services/settings');
      expect(() => validateSettingValue('sync.enabled', 'not-boolean'))
        .toThrow('Expected boolean value');
    });

    it('should validate array values', async () => {
      // ACT
      const { validateSettingValue } = await import('@/lib/services/settings');
      const result = validateSettingValue('notifications.email.recipients', ['test@example.com']);
      
      // ASSERT
      expect(result).toBe(true);
    });
  });
});
