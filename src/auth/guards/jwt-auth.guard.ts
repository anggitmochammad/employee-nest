import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
// Guard ini menjalankan strategi "jwt": membaca Bearer token, memverifikasi signature
// dan masa berlaku, lalu menempatkan hasil JwtStrategy.validate() pada request.user.
// Request tanpa token yang valid otomatis mendapat respons 401 Unauthorized.
export class JwtAuthGuard extends AuthGuard('jwt') {}
