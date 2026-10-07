import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../auth.types.js';
import { Role } from '../auth.types.js';
import { ROLES_KEY } from '../decorators/roles.decorator.js';

type AuthenticatedRequest = Request & { user?: AuthenticatedUser };

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Metadata method diprioritaskan; metadata controller menjadi nilai fallback.
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Endpoint tanpa @Roles() tidak memerlukan pemeriksaan role tambahan.
    if (!requiredRoles?.length) {
      return true;
    }

    // JwtAuthGuard harus dijalankan lebih dulu agar request.user sudah tersedia.
    // Nilai false akan diterjemahkan Nest menjadi 403 Forbidden.
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    return Boolean(request.user && requiredRoles.includes(request.user.role));
  }
}
