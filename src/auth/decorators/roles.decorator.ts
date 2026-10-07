import { SetMetadata } from '@nestjs/common';
import { Role } from '../auth.types.js';

// Key ini harus sama dengan key yang dibaca Reflector di RolesGuard.
export const ROLES_KEY = 'roles';

// Menyimpan daftar role yang diizinkan sebagai metadata endpoint atau controller.
// Contoh: @Roles(Role.ADMIN) hanya mengizinkan user dengan role admin.
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
