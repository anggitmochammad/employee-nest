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
  create(@Body() dto: CreateEmployeeDto) {
    return this.employees.create(dto);
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
  update(@Param() params: EmployeeIdDto, @Body() dto: UpdateEmployeeDto) {
    return this.employees.update(params.id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Hapus employee', description: 'Role: admin.' })
  @ApiNoContentResponse({ description: 'Berhasil dihapus' })
  @ApiNotFoundResponse({ description: 'Employee tidak ditemukan' })
  remove(@Param() params: EmployeeIdDto) {
    return this.employees.remove(params.id);
  }
}
