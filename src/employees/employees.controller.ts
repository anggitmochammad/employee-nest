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
import { EmployeesService } from './employees.service.js';
import { CreateEmployeeDto } from './dto/create-employee.dto.js';
import { UpdateEmployeeDto } from './dto/update-employee.dto.js';
import { EmployeeIdDto } from './dto/employee-id.dto.js';
import { ListEmployeesQueryDto } from './dto/list-employees-query.dto.js';
import {
  EmployeeListResponseDto,
  EmployeeResponseDto,
} from './dto/employee-response.dto.js';
import type { Response } from 'express';
import { Res } from '@nestjs/common';

@ApiTags('Employees')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ description: 'Bearer token tidak valid' })
@ApiForbiddenResponse({ description: 'Role tidak memiliki akses' })
@Controller('employees')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class EmployeesController {
  constructor(private readonly employees: EmployeesService) {}

  @Get()
  @Roles(Role.ADMIN, Role.VIEWER)
  @ApiOperation({
    summary: 'Daftar employee',
    description:
      'Role: admin, viewer. Mendukung pagination, pencarian, filter, dan sorting.',
  })
  @ApiOkResponse({ type: EmployeeListResponseDto })
  findAll(@Query() query: ListEmployeesQueryDto) {
    return this.employees.findAll(query);
  }

  @Get('export')
  @Roles(Role.ADMIN, Role.VIEWER)
  @ApiOperation({
    summary: 'Export seluruh employee ke CSV',
    description:
      'Role: admin, viewer. Memuat nama department; urutan ID menaik.',
  })
  @ApiOkResponse({
    description: 'File CSV UTF-8',
    content: { 'text/csv': { schema: { type: 'string', format: 'binary' } } },
  })
  async export(@Res() response: Response): Promise<void> {
    const csv = await this.employees.exportCsv();
    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader(
      'Content-Disposition',
      'attachment; filename="employees.csv"',
    );
    response.status(200).send(csv);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.VIEWER)
  @ApiOperation({
    summary: 'Detail employee',
    description: 'Role: admin, viewer.',
  })
  @ApiOkResponse({ type: EmployeeResponseDto })
  @ApiNotFoundResponse({ description: 'Employee tidak ditemukan' })
  findOne(@Param() params: EmployeeIdDto) {
    return this.employees.findOne(params.id);
  }

  @Post()
  @ApiOperation({ summary: 'Tambah employee', description: 'Role: admin.' })
  @ApiCreatedResponse({ type: EmployeeResponseDto })
  @ApiBadRequestResponse({ description: 'Data atau department tidak valid' })
  @ApiConflictResponse({ description: 'Email sudah dipakai employee lain' })
  create(
    @Body() dto: CreateEmployeeDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.employees.create(dto, user.id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Ubah employee',
    description: 'Role: admin. Kirim setidaknya satu field.',
  })
  @ApiOkResponse({ type: EmployeeResponseDto })
  @ApiBadRequestResponse({ description: 'Data atau department tidak valid' })
  @ApiNotFoundResponse({ description: 'Employee tidak ditemukan' })
  @ApiConflictResponse({ description: 'Email sudah dipakai employee lain' })
  update(
    @Param() params: EmployeeIdDto,
    @Body() dto: UpdateEmployeeDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.employees.update(params.id, dto, user.id);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Hapus employee', description: 'Role: admin.' })
  @ApiNoContentResponse({ description: 'Berhasil dihapus' })
  @ApiNotFoundResponse({ description: 'Employee tidak ditemukan' })
  remove(
    @Param() params: EmployeeIdDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.employees.remove(params.id, user.id);
  }
}
