import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthService } from './auth.service.js';
import type { AuthenticatedUser } from './auth.types.js';
import { CurrentUser } from './decorators/current-user.decorator.js';
import { LoginDto } from './dto/login.dto.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Login menggunakan email dan password' })
  @ApiOkResponse({ description: 'Login berhasil dan access token dibuat' })
  @ApiUnauthorizedResponse({ description: 'Email atau password tidak valid' })
  login(@Body() credentials: LoginDto) {
    return this.auth.login(credentials);
  }

  @Get('me')
  // JwtAuthGuard wajib berada sebelum CurrentUser karena guard yang mengisi request.user.
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Melihat pengguna yang sedang login' })
  @ApiOkResponse({ description: 'Data pengguna dari access token' })
  @ApiUnauthorizedResponse({ description: 'Access token tidak valid' })
  me(@CurrentUser() user: AuthenticatedUser): AuthenticatedUser {
    return user;
  }
}
