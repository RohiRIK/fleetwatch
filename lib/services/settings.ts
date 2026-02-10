/**
 * Settings Service
 * Manages application settings with validation, encryption, and defaults
 */

import { db } from '@/lib/db/drizzle';
import { settings } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import type { Setting, NewSetting } from '@/lib/db/schema';
import type { 
  SettingKey, 
  SettingValue, 
  SettingCategory,
  SyncMode,
  SettingTypeMap
} from '@/lib/types/settings';
import { 
  DEFAULT_SETTINGS, 
  SETTING_DESCRIPTIONS,
  SETTING_CATEGORIES 
} from '@/lib/types/settings';
import crypto from 'crypto';
import CronExpressionParser from 'cron-parser';

// ============================================================================
// Encryption Configuration
// ============================================================================

const ALGORITHM = 'aes-256-gcm';

// Generate a proper 32-byte key from the environment variable or default
function getEncryptionKey(): Buffer {
  const keyString = process.env.SETTINGS_ENCRYPTION_KEY || 'default-key-32-chars-00000000';
  
  // Ensure exactly 32 bytes by padding or truncating
  const keyBuffer = Buffer.alloc(32);
  const sourceBuffer = Buffer.from(keyString, 'utf8');
  sourceBuffer.copy(keyBuffer, 0, 0, Math.min(32, sourceBuffer.length));
  
  return keyBuffer;
}

const ENCRYPTION_KEY = getEncryptionKey();

// ============================================================================
// Get Settings
// ============================================================================

/**
 * Fetch all settings or filter by category
 */
export async function getSettings(category?: SettingCategory): Promise<Setting[]> {
  if (category) {
    return await db.select().from(settings).where(eq(settings.category, category));
  }
  return await db.select().from(settings);
}

/**
 * Fetch a single setting by key
 */
export async function getSetting(key: SettingKey): Promise<Setting | null> {
  const result = await db.select().from(settings).where(eq(settings.id, key));
  return result.length > 0 ? result[0] : null;
}

/**
 * Get setting value with type safety, fallback to default if not in DB
 */
export async function getSettingValue<K extends SettingKey>(
  key: K
): Promise<SettingTypeMap[K]> {
  const setting = await getSetting(key);
  
  if (setting) {
    // Decrypt if encrypted
    if (setting.encrypted && typeof setting.value === 'string') {
      return decryptSensitiveValue(setting.value) as SettingTypeMap[K];
    }
    return setting.value as SettingTypeMap[K];
  }
  
  // Return default value if not in database
  return DEFAULT_SETTINGS[key] as SettingTypeMap[K];
}

// ============================================================================
// Update Settings
// ============================================================================

/**
 * Update or create a setting with validation
 */
export async function updateSetting(
  key: SettingKey,
  value: SettingValue,
  userId: string
): Promise<Setting> {
  // Validate the value
  validateSettingValue(key, value);
  
  // Check if setting exists
  const existing = await getSetting(key);
  
  // Determine if value should be encrypted
  const shouldEncrypt = key === 'notifications.webhook.url' && value !== '';
  const finalValue = shouldEncrypt ? encryptSensitiveValue(value as string) : value;
  
  // Extract category from key (e.g., 'sync.schedule' -> 'sync')
  const category = key.split('.')[0] as SettingCategory;
  const settingKey = key.split('.').slice(1).join('.');
  
  if (existing) {
    // Update existing setting
    const updated = await db
      .update(settings)
      .set({
        value: finalValue,
        encrypted: shouldEncrypt,
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(eq(settings.id, key))
      .returning();
    
    return updated[0];
  } else {
    // Insert new setting
    const newSetting: NewSetting = {
      id: key,
      category,
      key: settingKey,
      value: finalValue,
      encrypted: shouldEncrypt,
      description: SETTING_DESCRIPTIONS[key] || null,
      defaultValue: DEFAULT_SETTINGS[key] || null,
      updatedBy: userId,
      updatedAt: new Date(),
      createdAt: new Date(),
    };
    
    const inserted = await db
      .insert(settings)
      .values(newSetting)
      .returning();
    
    return inserted[0];
  }
}

/**
 * Reset a setting to its default value
 */
export async function resetSetting(key: SettingKey): Promise<Setting> {
  const defaultValue = DEFAULT_SETTINGS[key];
  
  const updated = await db
    .update(settings)
    .set({
      value: defaultValue,
      encrypted: false,
      updatedAt: new Date(),
    })
    .where(eq(settings.id, key))
    .returning();
  
  return updated[0];
}

// ============================================================================
// Encryption/Decryption
// ============================================================================

/**
 * Encrypt sensitive values (webhook URLs, API keys)
 */
export function encryptSensitiveValue(plaintext: string): string {
  if (plaintext === '') return '';
  
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  // Format: iv:authTag:encrypted
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt encrypted values
 */
export function decryptSensitiveValue(encrypted: string): string {
  if (encrypted === '') return '';
  
  const parts = encrypted.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted format');
  }
  
  const [ivHex, authTagHex, encryptedHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  
  const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate setting value based on type and constraints
 */
export function validateSettingValue(key: SettingKey, value: SettingValue): boolean {
  switch (key) {
    // Cron expression validation
    case 'sync.schedule':
      if (typeof value !== 'string') {
        throw new Error('Expected string value');
      }
      try {
        CronExpressionParser.parse(value);
        return true;
      } catch (error) {
        throw new Error('Invalid cron expression');
      }
    
    // Sync mode enum validation
    case 'sync.mode':
      if (typeof value !== 'string') {
        throw new Error('Expected string value');
      }
      const validModes: SyncMode[] = ['full', 'incremental', 'deep'];
      if (!validModes.includes(value as SyncMode)) {
        throw new Error('Invalid sync mode. Must be: full, incremental, or deep');
      }
      return true;
    
    // Boolean validation
    case 'sync.enabled':
    case 'notifications.email.enabled':
    case 'system.maintenance':
      if (typeof value !== 'boolean') {
        throw new Error('Expected boolean value');
      }
      return true;
    
    // Email array validation
    case 'notifications.email.recipients':
      if (!Array.isArray(value)) {
        throw new Error('Expected array value');
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      for (const email of value) {
        if (typeof email !== 'string' || !emailRegex.test(email)) {
          throw new Error('Invalid email format');
        }
      }
      return true;
    
    // URL validation
    case 'notifications.webhook.url':
      if (typeof value !== 'string') {
        throw new Error('Expected string value');
      }
      if (value !== '' && !isValidUrl(value)) {
        throw new Error('Invalid URL format');
      }
      return true;
    
    // Percentage validation (0-100)
    case 'notifications.thresholds.compliance':
      if (typeof value !== 'number') {
        throw new Error('Expected number value');
      }
      if (value < 0 || value > 100) {
        throw new Error('Value must be between 0 and 100');
      }
      return true;
    
    // Number validation
    case 'notifications.thresholds.syncErrors':
      if (typeof value !== 'number') {
        throw new Error('Expected number value');
      }
      if (value < 0) {
        throw new Error('Value must be >= 0');
      }
      return true;
    
    // String validation (Azure settings)
    case 'azure.tenantId':
    case 'azure.clientId':
      if (typeof value !== 'string') {
        throw new Error('Expected string value');
      }
      return true;
    
    default:
      return true;
  }
}

/**
 * Validate URL format
 */
function isValidUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}
