import type { Request, Response, NextFunction } from 'express';

/**
 * Express error-handling middleware.
 * Logs the error and responds with a JSON payload.
 * Returns 502 (Bad Gateway) for OpenProject-related errors, otherwise 500.
 */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  console.error('[errorHandler]', err);

  const isOpError =
    err.message?.includes('OpenProject') || (err as any).opStatus;

  res.status(isOpError ? 502 : 500).json({
    error: err.message || 'Internal server error',
    ...(isOpError ? { detail: 'OpenProject API returned an error' } : {}),
  });
}

/**
 * Wraps an async Express request handler so that any rejected promise is
 * forwarded to the next() error handler instead of causing an unhandled rejection.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}