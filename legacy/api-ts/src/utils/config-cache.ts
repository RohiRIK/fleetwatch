/**
 * ConfigCache Utility
 *
 * Manages an in-memory cache of the .env configuration.
 * Provides thread-safe access and supports reactive updates via file watching.
 */

import { promises as fs } from 'fs';
import path from 'path';
import { logger } from './logger';

export interface EnvVariables {
  [key: string]: string;
}

export class ConfigCache {
  private static instance: ConfigCache;
  private cache: EnvVariables = {};
  private envPath: string;
  private lastLoaded: number = 0;
  private lastReloadAttempt: number = 0;
  private readonly RELOAD_COOLDOWN = 5000; // 5 seconds cooldown

  private constructor() {
    this.envPath = path.join(process.cwd(), '.env');
  }

  /**
   * For testing purposes only: override the .env path
   */
  public setEnvPath(newPath: string): void {
    this.envPath = newPath;
  }

  public static getInstance(): ConfigCache {
    if (!ConfigCache.instance) {
      ConfigCache.instance = new ConfigCache();
    }
    return ConfigCache.instance;
  }

  public async loadFromDisk(): Promise<boolean> {
    const now = Date.now();
    this.lastReloadAttempt = now;

    try {
      const content = await fs.readFile(this.envPath, 'utf-8');
      
      let newVars: EnvVariables;
      try {
        newVars = this.parseEnv(content);
      } catch (parseError: any) {
        logger.error(`[ConfigCache] Parse error in .env file: ${parseError.message}. Keeping existing configuration.`);
        return false;
      }

      // Basic validation: ensure we got at least some variables
      if (Object.keys(newVars).length === 0 && content.trim().length > 0) {
        logger.warn('[ConfigCache] Parsed .env file but found no variables. This might be a parsing error. Keeping existing configuration.');
        return false;
      }
      
      // Update cache
      this.cache = newVars;
      this.lastLoaded = now;
      
      logger.info('[ConfigCache] Configuration reloaded successfully');
      return true;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        logger.warn('[ConfigCache] .env file not found, using existing cache');
        return false;
      }
      
      logger.error(`[ConfigCache] CRITICAL: Failed to parse .env file: ${error.message}. Retaining existing configuration.`);
      return false;
    }
  }

  /**
   * Get a variable from the cache
   */
  public get(key: string, defaultValue?: string): string | undefined {
    return this.cache[key] ?? process.env[key] ?? defaultValue;
  }

  /**
   * Get all variables from cache
   */
  public getAll(): EnvVariables {
    return { ...this.cache };
  }

  /**
   * Force a manual reload if requested (Lazy Fallback)
   * Includes rate-limiting to prevent DoS via invalid tokens
   */
  public async forceReload(): Promise<boolean> {
    const now = Date.now();
    const timeSinceLastAttempt = now - this.lastReloadAttempt;

    if (timeSinceLastAttempt < this.RELOAD_COOLDOWN) {
      // Too soon, skip disk read
      return false;
    }

    logger.info('[ConfigCache] Forcing manual configuration reload...');
    return await this.loadFromDisk();
  }

  /**
   * Parse .env file content
   * Implements robust parsing with better error detection
   */
  private parseEnv(content: string): EnvVariables {
    const vars: EnvVariables = {};
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Skip comments and empty lines
      if (!line || line.startsWith('#')) {
        continue;
      }

      // More robust regex for KEY=VALUE
      // Supports lowercase, dots, and underscores in keys
      const match = line.match(/^([-a-zA-Z0-9_.]+)\s*=\s*(.*)$/);
      
      if (!match) {
        // Instead of throwing immediately, we check if it's an obvious error or just a weird line
        // If it contains an '=', it's probably a malformed variable
        if (line.includes('=')) {
          throw new Error(`Syntax error on line ${i + 1}: "${line}". Keys must be alphanumeric/underscores/dots/hyphens.`);
        }
        // Otherwise, skip it as a non-assignment line (could be a stray comment or text)
        logger.warn(`[ConfigCache] Skipping non-assignment line ${i + 1}: "${line}"`);
        continue;
      }

      const [, key, rawValue] = match;
      let value = rawValue.trim();

      // Handle quoted values vs unquoted with trailing comments
      const firstChar = value.charAt(0);
      if (firstChar === '"' || firstChar === "'") {
        // Find matching closing quote
        const endQuoteIndex = value.indexOf(firstChar, 1);
        if (endQuoteIndex !== -1) {
          value = value.substring(1, endQuoteIndex);
        } else {
          // Unterminated quote, strip the first char but keep the rest
          value = value.substring(1);
        }
      } else {
        // Unquoted: remove trailing comments
        const hashIndex = value.indexOf('#');
        if (hashIndex !== -1) {
          value = value.substring(0, hashIndex).trim();
        }
      }

      vars[key] = value;
    }

    return vars;
  }
}

export const configCache = ConfigCache.getInstance();
