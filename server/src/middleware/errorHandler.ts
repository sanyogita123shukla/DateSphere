import { Request, Response, NextFunction } from 'express';

/**
 * Global async error handler for Express routes.
 * Wraps route handlers to catch async errors and pass them to the error middleware.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Global error handling middleware.
 * Must be registered LAST with app.use().
 */
export function globalErrorHandler(
  err: Error & { statusCode?: number; code?: string },
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = err.statusCode || 500;
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    console.error(`[ERROR] ${err.message}`, err.stack);
  }

  res.status(statusCode).json({
    success: false,
    error: statusCode === 500 && !isDev
      ? 'An unexpected error occurred. Please try again.'
      : err.message,
    code: err.code || 'INTERNAL_ERROR',
    ...(isDev && { stack: err.stack }),
  });
}

/**
 * Creates a typed HTTP error with status code.
 */
export class HttpError extends Error {
  statusCode: number;
  code: string;

  constructor(message: string, statusCode: number, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code || 'ERROR';
    this.name = 'HttpError';
  }
}
