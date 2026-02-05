import type { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger'; // Import our new logger

export interface ApiError extends Error {
  status?: number;
  details?: any;
}

export interface ErrorResponse {
  error: string;
  message: string;
  timestamp: string;
  path: string;
  details?: any;
}

// ... other interfaces ...

/**
 * Global error handler middleware
 */
export function errorHandler(
  err: ApiError,
  req: Request,
  res: Response,
  next: NextFunction
) {
  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';

  const errorResponse: ErrorResponse = {
    error: err.name || 'Error',
    message,
    timestamp: new Date().toISOString(),
    path: req.path
  };

  // Include details in development
  if (process.env.NODE_ENV !== 'production' && err.details) {
    errorResponse.details = err.details;
  }

  // Log error using Winston
  logger.error({
    action: 'API Error',
    source: 'system',
    message: err.message,
    severity: 'error',
    metadata: {
      status,
      errorName: err.name,
      stack: err.stack,
      path: req.path,
      method: req.method,
      details: err.details
    }
  });

  res.status(status).json(errorResponse);
}
// ... rest of the file ...

/**
 * 404 Not Found handler
 */
export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
    timestamp: new Date().toISOString(),
    path: req.path
  });
}

/**
 * Create custom error
 */
export function createError(
  message: string,
  status: number = 500,
  details?: any
): ApiError {
  const error = new Error(message) as ApiError;
  error.status = status;
  error.details = details;
  return error;
}

/**
 * Async handler wrapper - catches async errors
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
