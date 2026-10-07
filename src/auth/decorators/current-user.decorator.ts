import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../auth.types.js';

type AuthenticatedRequest = Request & { user: AuthenticatedUser };

// Mengambil user yang sebelumnya ditempelkan Passport ke request oleh JwtStrategy.validate().
// Dengan decorator ini controller tidak perlu mengakses objek request secara langsung.
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().user,
);
