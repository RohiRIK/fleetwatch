
import Redis from 'ioredis';
import { readFileSync, accessSync, constants } from 'fs';
import path from 'path';

function parseEnvFile(content: string): Record<string, string> {
  const vars: Record<string, string> = {};
  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
    if (match) {
      vars[match[1]] = match[2].replace(/^["']|["']$/g, '');
    }
  }
  return vars;
}

async function syncToRedis() {
  const envContent = readFileSync('/app/.env', 'utf8');
  const env = parseEnvFile(envContent);

  const redisUrl = env.REDIS_URL || process.env.REDIS_URL || 'redis://redis:6379';
  console.log(`Connecting to Redis at ${redisUrl}...`);
  
  const redis = new Redis(redisUrl);

  try {
    const clientId = env.CLIENT_ID;
    const tenantId = env.TENANT_ID;
    const thumbprint = env.AZURE_CERTIFICATE_THUMBPRINT;
    const certPath = env.AZURE_CERTIFICATE_PATH;
    const keyPath = env.AZURE_CERTIFICATE_KEY_PATH;
    const pfxPath = env.AZURE_CERTIFICATE_PFX_PATH;
    const pfxPassword = env.AZURE_CERTIFICATE_PFX_PASSWORD;

    if (!clientId || !tenantId || !thumbprint) {
      console.error('Missing required environment variables in .env');
      process.exit(1);
    }

    const REDIS_CREDENTIAL_TTL = 90 * 24 * 60 * 60; // 90 days

    console.log('Storing base credentials...');
    await redis.setex('fetcher:client_id', REDIS_CREDENTIAL_TTL, clientId);
    await redis.setex('fetcher:tenant_id', REDIS_CREDENTIAL_TTL, tenantId);
    await redis.setex('fetcher:certificate_thumbprint', REDIS_CREDENTIAL_TTL, thumbprint);
    
    if (certPath) await redis.setex('fetcher:certificate_path', REDIS_CREDENTIAL_TTL, certPath);
    if (keyPath) await redis.setex('fetcher:certificate_key_path', REDIS_CREDENTIAL_TTL, keyPath);
    if (pfxPath) await redis.setex('fetcher:certificate_pfx_path', REDIS_CREDENTIAL_TTL, pfxPath);
    if (pfxPassword) await redis.setex('fetcher:certificate_pfx_password', REDIS_CREDENTIAL_TTL, pfxPassword);

    // Storing raw contents
    console.log('Reading certificate files from disk...');
    
    if (certPath) {
      try {
        const content = readFileSync(certPath, 'utf8');
        await redis.setex('fetcher:certificate_content', REDIS_CREDENTIAL_TTL, content);
        console.log('✓ Stored certificate content');
      } catch (e: any) {
        console.warn(`Failed to read cert file: ${e.message}`);
      }
    }

    if (keyPath) {
      try {
        const content = readFileSync(keyPath, 'utf8');
        await redis.setex('fetcher:certificate_key_content', REDIS_CREDENTIAL_TTL, content);
        console.log('✓ Stored private key content');
      } catch (e: any) {
        console.warn(`Failed to read key file: ${e.message}`);
      }
    }

    if (pfxPath) {
      try {
        const content = readFileSync(pfxPath);
        await redis.setex('fetcher:certificate_pfx_base64', REDIS_CREDENTIAL_TTL, content.toString('base64'));
        console.log('✓ Stored PFX content (base64)');
      } catch (e: any) {
        console.warn(`Failed to read PFX file: ${e.message}`);
      }
    }

    // Set reload flag
    await redis.setex('provisioning:fetcher_needs_reload', 300, 'true');
    console.log('✓ Set fetcher reload flag');

    console.log('\nSUCCESS: All credentials synchronized to Redis.');
  } catch (error: any) {
    console.error('FAILED:', error.message);
  } finally {
    await redis.quit();
  }
}

syncToRedis();
