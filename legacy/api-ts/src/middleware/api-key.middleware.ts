/**
 * API Key Middleware
 * 
 * Validates X-API-Key header for third-party integrations.
 */

import { Request, Response, NextFunction } from 'express';
import { integrationService } from '../services/integration.service';

export async function apiKeyMiddleware(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.header('X-API-Key');

  if (!apiKey) {
    return res.status(401).json({
      error: {
        code: 'MISSING_API_KEY',
        message: 'X-API-Key header is required'
      }
    });
  }

  try {
    const integration = await integrationService.validateKey(apiKey);

    if (!integration) {
      return res.status(401).json({
        error: {
          code: 'INVALID_API_KEY',
          message: 'The provided API key is invalid or inactive'
        }
      });
    }

    // Attach integration info to request
    (req as any).integration = integration;
    next();
  } catch (error) {
    console.error('[ApiKeyMiddleware] Validation error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to validate API key'
      }
    });
  }
}
