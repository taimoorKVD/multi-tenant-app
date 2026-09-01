import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

/**
 * Removes deprecated create-tenant body fields before validation.
 * Admin credentials are provisioned server-side from `name` + `email` only.
 */
@Injectable()
export class StripLegacyCreateTenantBodyMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction): void {
    if (req.method !== 'POST' || !req.body || typeof req.body !== 'object') {
      next();
      return;
    }

    delete req.body.admin;
    delete req.body.confirmPassword;
    delete req.body.confirm_password;

    next();
  }
}
