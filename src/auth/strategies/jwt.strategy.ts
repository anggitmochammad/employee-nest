import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  Role,
  type AuthenticatedUser,
  type JwtPayload,
} from '../auth.types.js';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      // Token diambil dari header: Authorization: Bearer <token>.
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    // User dibaca ulang agar token milik akun yang sudah dihapus tidak tetap berlaku.
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, name: true, email: true, role: true },
    });

    if (!user || !Object.values(Role).includes(user.role as Role)) {
      throw new UnauthorizedException('Invalid or expired access token');
    }

    // Object ini akan menjadi request.user; password sengaja tidak pernah disertakan.
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role as Role,
    };
  }
}
