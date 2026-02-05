import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

// Format: IV:AuthTag:EncryptedData
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getKey(manualKey?: string): Buffer {
  const key = manualKey || process.env.CONFIG_ENCRYPTION_KEY;
  if (!key) {
    throw new Error('CONFIG_ENCRYPTION_KEY is not set');
  }
  // Support hex string (64 chars) or raw string (32 chars)
  if (key.length === 64) {
    return Buffer.from(key, 'hex');
  }
  if (key.length === 32) {
    return Buffer.from(key, 'utf-8');
  }
  throw new Error(`Invalid CONFIG_ENCRYPTION_KEY length: ${key.length}. Expected 32 bytes (raw) or 64 hex chars.`);
}

/**
 * Encrypts a string using AES-256-GCM with a random IV.
 * @param text The plain text to encrypt
 * @param manualKey Optional encryption key to use (overrides process.env)
 * @returns The encrypted string in format "IV:AuthTag:EncryptedData" (hex)
 */
export function encrypt(text: string, manualKey?: string): string {
  if (!text) return text;
  
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getKey(manualKey), iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypts a string using AES-256-GCM.
 * @param encryptedText The encrypted string in format "IV:AuthTag:EncryptedData" (hex)
 * @param manualKey Optional encryption key to use (overrides process.env)
 * @returns The decrypted plain text
 */
export function decrypt(encryptedText: string, manualKey?: string): string {
  if (!encryptedText) return encryptedText;
  
  const parts = encryptedText.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted text format. Expected IV:AuthTag:EncryptedData');
  }
  
  const [ivHex, authTagHex, contentHex] = parts;
  
  try {
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = createDecipheriv(ALGORITHM, getKey(manualKey), iv);
    
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(contentHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error: any) {
    throw new Error(`Decryption failed: ${error.message}`);
  }
}
