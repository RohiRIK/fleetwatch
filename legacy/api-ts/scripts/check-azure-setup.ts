#!/usr/bin/env bun
/**
 * Azure Setup Checker
 *
 * Verifies Azure App Registration configuration and provides guidance
 * for completing setup.
 */

import { readFile } from 'fs/promises';
import { join } from 'path';

interface SetupStatus {
  hasClientId: boolean;
  hasTenantId: boolean;
  hasClientSecret: boolean;
  hasCertificate: boolean;
  certificateComplete: boolean;
  readyToRun: boolean;
  missingItems: string[];
  nextSteps: string[];
}

async function checkSetup(): Promise<SetupStatus> {
  const status: SetupStatus = {
    hasClientId: false,
    hasTenantId: false,
    hasClientSecret: false,
    hasCertificate: false,
    certificateComplete: false,
    readyToRun: false,
    missingItems: [],
    nextSteps: []
  };

  try {
    // Read .env file
    const envPath = join(process.cwd(), '.env');
    const envContent = await readFile(envPath, 'utf8');

    // Simple .env parser
    const env: Record<string, string> = {};
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          env[key.trim()] = valueParts.join('=').trim();
        }
      }
    }

    // Check basic credentials
    status.hasClientId = !!env.CLIENT_ID && env.CLIENT_ID !== '';
    status.hasTenantId = !!env.TENANT_ID && env.TENANT_ID !== '';
    status.hasClientSecret = !!env.CLIENT_SECRET && env.CLIENT_SECRET !== '';

    // Check certificate configuration
    const hasCertThumbprint = !!env.AZURE_CERTIFICATE_THUMBPRINT;
    const hasCertPath = !!env.AZURE_CERTIFICATE_PATH;
    const hasCertKeyPath = !!env.AZURE_CERTIFICATE_KEY_PATH;

    status.hasCertificate = hasCertThumbprint && hasCertPath && hasCertKeyPath;

    // Verify certificate files exist
    if (status.hasCertificate) {
      try {
        await readFile(env.AZURE_CERTIFICATE_PATH!, 'utf8');
        await readFile(env.AZURE_CERTIFICATE_KEY_PATH!, 'utf8');
        status.certificateComplete = true;
      } catch {
        status.certificateComplete = false;
      }
    }

    // Determine readiness
    status.readyToRun = status.hasClientId &&
                        status.hasTenantId &&
                        (status.certificateComplete || status.hasClientSecret);

    // Build missing items list
    if (!status.hasClientId) status.missingItems.push('CLIENT_ID');
    if (!status.hasTenantId) status.missingItems.push('TENANT_ID');
    if (!status.certificateComplete && !status.hasClientSecret) {
      status.missingItems.push('Authentication method (CLIENT_SECRET or certificate)');
    }

    // Build next steps
    if (!status.hasClientId || !status.hasTenantId) {
      status.nextSteps.push('1. Create Azure App Registration:');
      status.nextSteps.push('   - Go to http://localhost/dashboard/settings');
      status.nextSteps.push('   - Click "Create App Registration" button');
      status.nextSteps.push('   - Follow the OAuth flow to create the app');
    } else if (!status.certificateComplete && !status.hasClientSecret) {
      status.nextSteps.push('1. The App Registration exists but needs credentials:');
      status.nextSteps.push('   Option A: Complete the setup via Settings page (will generate certificate)');
      status.nextSteps.push('   Option B: Add CLIENT_SECRET to .env file manually');
    } else if (status.hasClientSecret && !status.hasCertificate) {
      status.nextSteps.push('✅ Setup complete (using CLIENT_SECRET)');
      status.nextSteps.push('');
      status.nextSteps.push('💡 Recommendation: Migrate to certificate authentication for better security');
      status.nextSteps.push('   - Go to Settings page');
      status.nextSteps.push('   - Click "Rotate Certificate" (when implemented)');
    } else if (status.certificateComplete) {
      status.nextSteps.push('✅ Setup complete (using certificate authentication)');
      status.nextSteps.push('');
      status.nextSteps.push('🎉 Your Azure setup is fully configured and secure!');
    }

    return status;

  } catch (error: any) {
    console.error('Error checking setup:', error.message);
    status.missingItems.push('.env file');
    status.nextSteps.push('1. Create .env file from .env.example');
    status.nextSteps.push('2. Run this script again');
    return status;
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('Azure App Registration Setup Checker');
  console.log('='.repeat(60));
  console.log('');

  const status = await checkSetup();

  // Display status
  console.log('📋 Current Status:');
  console.log('-'.repeat(60));
  console.log(`CLIENT_ID:      ${status.hasClientId ? '✅ Set' : '❌ Missing'}`);
  console.log(`TENANT_ID:      ${status.hasTenantId ? '✅ Set' : '❌ Missing'}`);
  console.log(`CLIENT_SECRET:  ${status.hasClientSecret ? '✅ Set' : '❌ Not set'}`);
  console.log(`Certificate:    ${status.certificateComplete ? '✅ Configured and files exist' : status.hasCertificate ? '⚠️ Configured but files missing' : '❌ Not configured'}`);
  console.log('');

  console.log('🔐 Authentication Method:');
  console.log('-'.repeat(60));
  if (status.certificateComplete) {
    console.log('✅ Certificate-based (RECOMMENDED - Most secure)');
  } else if (status.hasClientSecret) {
    console.log('✅ Client Secret (Working but less secure)');
  } else {
    console.log('❌ No authentication method configured');
  }
  console.log('');

  console.log('📊 Overall Status:');
  console.log('-'.repeat(60));
  if (status.readyToRun) {
    console.log('✅ READY TO RUN');
    console.log('');
    console.log('Your fetcher service can now connect to Microsoft Graph API!');
    console.log('');
    console.log('Next steps:');
    console.log('1. Restart containers: docker compose restart fetcher');
    console.log('2. Check logs: docker compose logs -f fetcher');
  } else {
    console.log('❌ NOT READY - Setup incomplete');
    console.log('');
    if (status.missingItems.length > 0) {
      console.log('Missing items:');
      status.missingItems.forEach(item => console.log(`  - ${item}`));
      console.log('');
    }
  }

  if (status.nextSteps.length > 0) {
    console.log('📝 Next Steps:');
    console.log('-'.repeat(60));
    status.nextSteps.forEach(step => console.log(step));
  }

  console.log('');
  console.log('='.repeat(60));

  process.exit(status.readyToRun ? 0 : 1);
}

main();
