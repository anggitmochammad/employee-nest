import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Role } from '../auth/auth.types.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { AuditLogsService } from './audit-logs.service.js';
import { ListAuditLogsQueryDto } from './dto/list-audit-logs-query.dto.js';
import {
  AuditActorDto,
  AuditLogListResponseDto,
} from './dto/audit-log-response.dto.js';

@ApiTags('Audit Logs')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ description: 'Bearer token tidak valid' })
@ApiForbiddenResponse({ description: 'Khusus admin' })
@Controller('audit-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AuditLogsController {
  constructor(private readonly auditLogs: AuditLogsService) {}

  @Get('users')
  @ApiOperation({
    summary: 'Daftar pelaku audit',
    description:
      'Role: admin. Mengembalikan seluruh user yang pernah memiliki audit log.',
  })
  @ApiOkResponse({ type: AuditActorDto, isArray: true })
  findActors() {
    return this.auditLogs.findActors();
  }

  @Get()
  @ApiOperation({
    summary: 'Daftar audit log',
    description:
      'Role: admin. Filter diterapkan sebelum pagination. Rentang tanggal inklusif dalam zona waktu Asia/Jakarta. entityData berisi data terkait; previousData berisi data sebelum update.',
  })
  @ApiOkResponse({ type: AuditLogListResponseDto })
  findAll(@Query() query: ListAuditLogsQueryDto) {
    return this.auditLogs.findAll(query);
  }
}
