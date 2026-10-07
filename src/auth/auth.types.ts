export enum Role {
  ADMIN = 'admin',
  VIEWER = 'viewer',
}

export interface JwtPayload {
  sub: number;
  email: string;
  role: Role;
}

export interface AuthenticatedUser {
  id: number;
  name: string;
  email: string;
  role: Role;
}
