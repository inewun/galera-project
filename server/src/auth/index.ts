import type { Request, Response, NextFunction } from 'express';

/**
 * Authentication middleware.
 *
 * TODO: when config.authEnabled is true, validate the session / token obtained
 * from the OpenProject account. For now it passes through unconditionally.
 */
export function authMiddleware(
  _req: Request,
  _res: Response,
  next: NextFunction,
): void {
  next();
}