import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Role } from '../auth/auth.types.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { DepartmentsService } from './departments.service.js';
import { DepartmentDto } from './dto/department.dto.js';
import { DepartmentIdDto } from './dto/department-id.dto.js';
import { DepartmentResponseDto } from './dto/department-response.dto.js';
import { ListDepartmentsQueryDto } from './dto/list-departments-query.dto.js';

@ApiTags('Departments')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({
  description: 'Token tidak tersedia atau tidak valid',
})
@ApiForbiddenResponse({ description: 'Role tidak memiliki akses' })
@Controller('departments')
// JWT mengisi request.user sebelum RolesGuard memeriksa role-nya.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class DepartmentsController {
  constructor(private readonly departments: DepartmentsService) {}

  @Get()
  @Roles(Role.ADMIN, Role.VIEWER)
  @ApiOperation({
    summary: 'Daftar department',
    description:
      'Role: admin, viewer. Search mencocokkan sebagian nama tanpa membedakan huruf besar-kecil. Diurutkan berdasarkan ID menaik.',
  })
  @ApiOkResponse({ type: DepartmentResponseDto, isArray: true })
  findAll(@Query() query: ListDepartmentsQueryDto) {
    return this.departments.findAll(query.search);
  }

  @Post()
  @ApiOperation({ summary: 'Tambah department', description: 'Role: admin.' })
  @ApiCreatedResponse({ type: DepartmentResponseDto })
  @ApiBadRequestResponse({
    description: 'Nama wajib berupa string yang tidak kosong',
  })
  @ApiConflictResponse({ description: 'Nama department sudah dipakai' })
  create(@Body() dto: DepartmentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.departments.create(dto, user.id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Ubah nama department',
    description: 'Role: admin. Body harus berisi name.',
  })
  @ApiOkResponse({ type: DepartmentResponseDto })
  @ApiBadRequestResponse({ description: 'ID atau nama tidak valid' })
  @ApiNotFoundResponse({ description: 'Department tidak ditemukan' })
  @ApiConflictResponse({ description: 'Nama department sudah dipakai' })
  update(
    @Param() params: DepartmentIdDto,
    @Body() dto: DepartmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.departments.update(params.id, dto, user.id);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Hapus department',
    description:
      'Role: admin. Department yang memiliki employee (aktif maupun nonaktif) tidak dapat dihapus.',
  })
  @ApiNoContentResponse({
    description: 'Department berhasil dihapus; tanpa response body',
  })
  @ApiBadRequestResponse({ description: 'ID tidak valid' })
  @ApiNotFoundResponse({ description: 'Department tidak ditemukan' })
  @ApiConflictResponse({ description: 'Department masih memiliki employee' })
  remove(
    @Param() params: DepartmentIdDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.departments.remove(params.id, user.id);
  }
}
