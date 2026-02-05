/**
 * EnvManager Service
 *
 * Manages .env file operations with atomic writes and backup functionality.
 * Provides safe environment variable updates for Azure App Registration configuration.
 */

import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface EnvVariables {
  [key: string]: string;
}

export interface EnvUpdateResult {
  success: boolean;
  backupPath?: string;
  error?: string;
}

export interface EnvCheckResult {
  exists: boolean;
  hasAzureConfig: boolean;
  missingVars: string[];
  allVars: string[];
}

/**
 * EnvManager - Safe .env file operations
 */
export class EnvManager {
  private envPath: string;
  private backupDir: string;

  constructor(envPath: string = path.join(process.cwd(), '.env')) {
    this.envPath = envPath;
    this.backupDir = path.join(process.cwd(), '.env.backups');
  }

  /**
   * Read and parse .env file
   */
  async readEnv(): Promise<EnvVariables> {
    try {
      const content = await fs.readFile(this.envPath, 'utf-8');
      return this.parseEnv(content);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return {}; // File doesn't exist, return empty object
      }
      throw new Error(`Failed to read .env file: ${error.message}`);
    }
  }

  /**
   * Parse .env file content into key-value pairs
   */
  private parseEnv(content: string): EnvVariables {
    const vars: EnvVariables = {};
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();

      // Skip comments and empty lines
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      // Parse KEY=VALUE
      const match = trimmed.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
      if (match) {
        const [, key, value] = match;
        // Remove surrounding quotes if present
        vars[key] = value.replace(/^["']|["']$/g, '');
      }
    }

    return vars;
  }

  /**
   * Serialize environment variables to .env format
   */
  private serializeEnv(vars: EnvVariables): string {
    const lines: string[] = [
      '# Device Inventory - Environment Configuration',
      '# Generated: ' + new Date().toISOString(),
      ''
    ];

    // Group variables by category
    const categories = {
      'Microsoft Graph API': ['CLIENT_ID', 'TENANT_ID', 'CLIENT_SECRET'],
      'Azure Certificate Auth': ['AZURE_CERTIFICATE_THUMBPRINT', 'AZURE_CERTIFICATE_PATH'],
      'Security Tokens': ['ADMIN_TOKEN', 'INGEST_SECRET'],
      'Lenovo Warranty API': ['LENOVO_CLIENT_ID', 'LENOVO_API_BASE', 'LENOVO_API_VERSION', 'LENOVO_WARRANTY_TTL_HOURS'],
      'Scheduler': ['SCHEDULER_ENABLED', 'CRON_SCHEDULE'],
      'OpenSearch': ['ES_NODE', 'ES_USER', 'ES_PASS'],
      'API': ['PORT', 'NODE_ENV'],
      'Fetcher': ['API_BASE', 'FETCHER_RUNTIME']
    };

    // Write categorized variables
    for (const [category, categoryKeys] of Object.entries(categories)) {
      const hasVars = categoryKeys.some(key => vars[key]);
      if (hasVars) {
        lines.push(`# ${category}`);
        for (const key of categoryKeys) {
          if (vars[key] !== undefined) {
            lines.push(`${key}="${vars[key]}"`);
          }
        }
        lines.push('');
      }
    }

    // Write remaining uncategorized variables
    const categorizedKeys = new Set(Object.values(categories).flat());
    const uncategorizedKeys = Object.keys(vars).filter(key => !categorizedKeys.has(key));
    if (uncategorizedKeys.length > 0) {
      lines.push('# Other Configuration');
      for (const key of uncategorizedKeys.sort()) {
        lines.push(`${key}="${vars[key]}"`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Create backup of current .env file
   */
  async createBackup(): Promise<string> {
    try {
      // Ensure backup directory exists
      await fs.mkdir(this.backupDir, { recursive: true });

      // Generate backup filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(this.backupDir, `.env.backup.${timestamp}`);

      // Copy current .env to backup
      await fs.copyFile(this.envPath, backupPath);

      // Set secure permissions (owner read/write only)
      await fs.chmod(backupPath, 0o600);

      return backupPath;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // No .env file to backup, that's okay
        return '';
      }
      throw new Error(`Failed to create backup: ${error.message}`);
    }
  }

  /**
   * Update .env file with new variables (atomic write with fallback for Docker volumes)
   */
  async updateEnv(updates: EnvVariables): Promise<EnvUpdateResult> {
    try {
      // Create backup first
      const backupPath = await this.createBackup();

      // Read current variables
      const currentVars = await this.readEnv();

      // Merge with updates
      const mergedVars = { ...currentVars, ...updates };

      // Update process.env in memory immediately so auth middleware sees changes without restart
      Object.entries(updates).forEach(([key, value]) => {
        process.env[key] = value;
      });

      // Serialize to .env format
      const content = this.serializeEnv(mergedVars);

      // Try atomic write first (write to temp file, then rename)
      const tempPath = `${this.envPath}.tmp.${crypto.randomBytes(8).toString('hex')}`;
      await fs.writeFile(tempPath, content, { mode: 0o600 });

      try {
        // Atomic rename (overwrites .env)
        await fs.rename(tempPath, this.envPath);
      } catch (renameError: any) {
        // If rename fails with EBUSY (Docker volume mount), fall back to direct write
        if (renameError.code === 'EBUSY' || renameError.code === 'EPERM') {
          console.warn('[EnvManager] Atomic rename failed (file is mounted), using direct write');

          // Clean up temp file
          try {
            await fs.unlink(tempPath);
          } catch {}

          // Write directly to .env (not atomic, but works with Docker volumes)
          await fs.writeFile(this.envPath, content, { mode: 0o600 });
        } else {
          // Some other error, rethrow
          throw renameError;
        }
      }

      return {
        success: true,
        backupPath: backupPath || undefined
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Check if required Azure configuration exists
   */
  async checkAzureConfig(): Promise<EnvCheckResult> {
    const vars = await this.readEnv();
    const allVars = Object.keys(vars);

    // Required Azure variables
    const requiredVars = ['CLIENT_ID', 'TENANT_ID'];

    // Check if we have either client secret OR certificate
    const hasClientSecret = !!vars.CLIENT_SECRET;
    const hasCertificate = !!(vars.AZURE_CERTIFICATE_THUMBPRINT && vars.AZURE_CERTIFICATE_PATH);

    const missingVars: string[] = [];

    // Check required base variables
    for (const varName of requiredVars) {
      if (!vars[varName]) {
        missingVars.push(varName);
      }
    }

    // Need either secret or certificate
    if (!hasClientSecret && !hasCertificate) {
      missingVars.push('CLIENT_SECRET or (AZURE_CERTIFICATE_THUMBPRINT + AZURE_CERTIFICATE_PATH)');
    }

    // Check if admin token exists
    if (!vars.ADMIN_TOKEN) {
      missingVars.push('ADMIN_TOKEN');
    }

    if (!vars.INGEST_SECRET) {
      missingVars.push('INGEST_SECRET');
    }

    return {
      exists: allVars.length > 0,
      hasAzureConfig: missingVars.length === 0,
      missingVars,
      allVars
    };
  }

  /**
   * Generate random token for ADMIN_TOKEN or INGEST_SECRET
   */
  static generateToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Clean up old backups (keep last N backups)
   */
  async cleanupOldBackups(keepCount: number = 10): Promise<number> {
    try {
      const files = await fs.readdir(this.backupDir);
      const backupFiles = files
        .filter(f => f.startsWith('.env.backup.'))
        .sort()
        .reverse();

      if (backupFiles.length <= keepCount) {
        return 0;
      }

      const toDelete = backupFiles.slice(keepCount);
      let deletedCount = 0;

      for (const file of toDelete) {
        await fs.unlink(path.join(this.backupDir, file));
        deletedCount++;
      }

      return deletedCount;
    } catch (error: any) {
      // If backup directory doesn't exist, that's fine
      if (error.code === 'ENOENT') {
        return 0;
      }
      throw error;
    }
  }

  /**
   * Validate .env file format and permissions
   */
  async validate(): Promise<{ valid: boolean; issues: string[] }> {
    const issues: string[] = [];

    try {
      // Check if file exists
      const stats = await fs.stat(this.envPath);

      // Check file permissions (should be 600 or 400)
      const mode = stats.mode & 0o777;
      if (mode !== 0o600 && mode !== 0o400) {
        issues.push(`Insecure file permissions: ${mode.toString(8)} (should be 600 or 400)`);
      }

      // Try to parse the file
      const vars = await this.readEnv();

      // Check for common issues
      if (Object.keys(vars).length === 0) {
        issues.push('No environment variables found');
      }

      // Check for variables with empty values
      for (const [key, value] of Object.entries(vars)) {
        if (value === '') {
          issues.push(`Variable ${key} has empty value`);
        }
      }

    } catch (error: any) {
      if (error.code === 'ENOENT') {
        issues.push('.env file does not exist');
      } else {
        issues.push(`Error reading .env file: ${error.message}`);
      }
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }

  /**
   * Get certificate info from environment and disk
   */
  async getCertificateInfo(): Promise<{
    hasCert: boolean;
    thumbprint?: string;
    privateKeyPem?: string;
    path?: string;
  }> {
    const vars = await this.readEnv();
    const thumbprint = vars.AZURE_CERTIFICATE_THUMBPRINT;
    const certPath = vars.AZURE_CERTIFICATE_PATH;

    if (!thumbprint || !certPath) {
      return { hasCert: false };
    }

    try {
      // The cert path in .env might be relative to the project root or absolute in container
      // If it's relative, we need to resolve it
      const resolvedPath = path.isAbsolute(certPath) 
        ? certPath 
        : path.join(process.cwd(), certPath);

      // Load private key (.key file is usually in the same dir as the cert but with .key extension)
      const keyPath = resolvedPath.replace(/\.(pfx|crt)$/, '.key');
      const privateKeyPem = await fs.readFile(keyPath, 'utf-8');

      return {
        hasCert: true,
        thumbprint,
        privateKeyPem,
        path: resolvedPath
      };
    } catch (error) {
      console.warn('[EnvManager] Error loading certificate files:', error);
      return { hasCert: false };
    }
  }
}

// Export singleton instance
export const envManager = new EnvManager();
