import crypto, { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
import { redisSessionService } from './redis-session.service';
import { configCache } from '../utils/config-cache';

/**
 * Service for securely managing all AI API keys in Redis.
 * Keys are encrypted at rest using AES-256-GCM.
 */
export class KeyManagementService {
  private readonly ALGORITHM = 'aes-256-gcm';
  
  // Derive a 32-byte encryption key from the environment secret
  private getEncryptionKey(): Buffer {
    const secret = configCache.get('INGEST_SECRET');
    
    if (!secret) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('CRITICAL SECURITY ERROR: INGEST_SECRET must be provided in production to secure AI API keys.');
      }
      // In development, we use a stable fallback to avoid breaking local setups if they haven't set it yet
      return scryptSync('dev-insecure-master-key-must-change-in-prod-12345', 'device-inventory-salt', 32);
    }

    // Deterministically derive 32 bytes from the secret
    return scryptSync(secret, 'device-inventory-salt', 32);
  }

  /**
   * Save an API key securely to Redis.
   */
  async saveKey(provider: string, key: string): Promise<void> {
    const redis = redisSessionService.getClient();
    if (!redis) throw new Error('Redis client not available');

    const iv = randomBytes(16);
    const masterKey = this.getEncryptionKey();
    const cipher = createCipheriv(this.ALGORITHM, masterKey, iv);
    
    let encrypted = cipher.update(key, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');

    // Store as JSON: { iv, content, tag }
    const payload = JSON.stringify({
      iv: iv.toString('hex'),
      content: encrypted,
      tag: authTag
    });

    // Key format: config:ai:openai, config:ai:gemini, etc.
    await redis.set(`config:ai:${provider.toLowerCase()}`, payload);
  }

  /**
   * Delete an API key from Redis.
   */
  async deleteKey(provider: string): Promise<void> {
    const redis = redisSessionService.getClient();
    if (!redis) throw new Error('Redis client not available');
    await redis.del(`config:ai:${provider.toLowerCase()}`);
  }

  /**
   * Retrieve and decrypt an API key from Redis, falling back to process.env.
   */
  async getKey(provider: string): Promise<string | null> {
    const redis = redisSessionService.getClient();
    
    // 1. Try Redis
    if (redis) {
      const payload = await redis.get(`config:ai:${provider.toLowerCase()}`);
      if (payload) {
        try {
          const { iv, content, tag } = JSON.parse(payload);
          const masterKey = this.getEncryptionKey();
          
          const decipher = createDecipheriv(
            this.ALGORITHM, 
            masterKey, 
            Buffer.from(iv, 'hex')
          );
          
          decipher.setAuthTag(Buffer.from(tag, 'hex'));
          
          let decrypted = decipher.update(content, 'hex', 'utf8');
          decrypted += decipher.final('utf8');
          
          return decrypted;
        } catch (error) {
          console.error(`Failed to decrypt key for ${provider}:`, error);
        }
      }
    }

    // 2. Fallback to Config Cache
    const envVar = `${provider.toUpperCase()}_API_KEY`;
    const cachedKey = configCache.get(envVar);
    if (cachedKey) return cachedKey;

    if (provider.toLowerCase() === 'google' || provider.toLowerCase() === 'gemini') {
        const googleKey = configCache.get('GOOGLE_GENERATIVE_AI_API_KEY') || configCache.get('GEMINI_API_KEY');
        if (googleKey) return googleKey;
    }

    return null;
  }

  /**
   * Set the active AI provider (e.g., 'openai', 'anthropic').
   */
  async setActiveProvider(provider: string): Promise<void> {
    const redis = redisSessionService.getClient();
    if (!redis) throw new Error('Redis client not available');
    await redis.set('config:ai:active_provider', provider.toLowerCase());
  }

  /**
   * Get the active AI provider. Defaults to 'openai'.
   */
  async getActiveProvider(): Promise<string> {
    const redis = redisSessionService.getClient();
    if (!redis) return 'openai';
    return (await redis.get('config:ai:active_provider')) || 'openai';
  }

  /**
   * Set the active AI model (e.g., 'gpt-4o', 'claude-3-5-sonnet').
   */
  async setActiveModel(model: string): Promise<void> {
    const redis = redisSessionService.getClient();
    if (!redis) throw new Error('Redis client not available');
    await redis.set('config:ai:active_model', model);
  }

  /**
   * Get the active AI model. Defaults depend on the provider.
   */
  async getActiveModel(provider: string): Promise<string> {
    const redis = redisSessionService.getClient();
    if (!redis) return this.getDefaultModel(provider);
    
    const savedModel = await redis.get('config:ai:active_model');
    return savedModel || this.getDefaultModel(provider);
  }

  private getDefaultModel(provider: string): string {
    switch (provider.toLowerCase()) {
      case 'openai': return 'gpt-4o';
      case 'anthropic': return 'claude-3-5-sonnet-20240620';
      case 'gemini': return 'gemini-1.5-flash';
      default: return 'gpt-4o';
    }
  }

  /**
   * Fetch available models from the provider's API.
   */
  async getAvailableModels(provider: string): Promise<string[]> {
    const key = await this.getKey(provider);
    if (!key) return [];

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      switch (provider.toLowerCase()) {
        case 'openai': {
          const response = await fetch('https://api.openai.com/v1/models', {
            headers: { 'Authorization': `Bearer ${key}` },
            signal: controller.signal
          });
          clearTimeout(timeoutId);
          const data = await response.json() as any;
          // Filter for chat models primarily
          return data.data
            .map((m: any) => m.id)
            .filter((id: string) => id.startsWith('gpt-') || id.startsWith('o1-'))
            .sort();
        }
        case 'gemini': {
          // Gemini uses a different URL structure and requires a key in query param
          const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`, {
            signal: controller.signal
          });
          clearTimeout(timeoutId);
          const data = await response.json() as any;
          
          if (!data.models) return [];

          return data.models
            // 1. Filter for models that support text generation
            .filter((m: any) => 
              m.supportedGenerationMethods?.includes('generateContent') || 
              m.supportedGenerationMethods?.includes('streamGenerateContent')
            )
            // 2. Exclude embedding, vision-only or robotics models that won't work with our agent
            .filter((m: any) => {
              const id = m.name.toLowerCase();
              return !id.includes('embedding') && !id.includes('robotics') && !id.includes('vision');
            })
            // 3. Map to clean ID and sort
            .map((m: any) => m.name.replace('models/', ''))
            .sort();
        }
        case 'anthropic': {
          clearTimeout(timeoutId);
          // Anthropic does not have a public "list models" endpoint.
          // We return a set of known good ones.
          return [
            'claude-3-5-sonnet-20240620',
            'claude-3-opus-20240229',
            'claude-3-haiku-20240307'
          ];
        }
        default:
          clearTimeout(timeoutId);
          return [];
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.warn(`Fetch timeout for ${provider} models`);
      } else {
        console.error(`Failed to fetch models for ${provider}:`, error);
      }
      return [];
    }
  }

  /**
   * Check if a key exists for a provider (Redis or Env).
   */
  async hasKey(provider: string): Promise<boolean> {
    const redis = redisSessionService.getClient();
    if (redis) {
      const exists = await redis.exists(`config:ai:${provider.toLowerCase()}`);
      if (exists === 1) return true;
    }

    // Check Config Cache
    const envVar = `${provider.toUpperCase()}_API_KEY`;
    if (configCache.get(envVar)) return true;

    if (provider.toLowerCase() === 'google' || provider.toLowerCase() === 'gemini') {
        if (configCache.get('GOOGLE_GENERATIVE_AI_API_KEY') || configCache.get('GEMINI_API_KEY')) return true;
    }

    return false;
  }
}

export const keyManagementService = new KeyManagementService();