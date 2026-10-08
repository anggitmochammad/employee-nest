import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditLogsService } from '../audit-logs/audit-logs.service.js';
import { employeesToCsv } from './employees.csv.js';
import type { ExportEmployeesQueryDto } from './dto/export-employees-query.dto.js';
import type { CreateEmployeeDto } from './dto/create-employee.dto.js';
import type { UpdateEmployeeDto } from './dto/update-employee.dto.js';
import {
  EmployeeSortBy,
  SortOrder,
  type ListEmployeesQueryDto,
} from './dto/list-employees-query.dto.js';

const withDepartment = {
  department: { select: { id: true, name: true } },
} as const;

@Injectable()
export class EmployeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  private employeeWhere({
    search,
    departmentId,
    status,
  }: ExportEmployeesQueryDto): Prisma.EmployeeWhereInput {
    return {
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(departmentId !== undefined ? { departmentId } : {}),
      ...(status !== undefined ? { status } : {}),
    };
  }

  async exportCsv(query: ExportEmployeesQueryDto): Promise<string> {
    const where = this.employeeWhere(query);
    const employees = await this.prisma.employee.findMany({
      where,
      include: { department: { select: { name: true } } },
      orderBy: { id: 'asc' },
    });
    return employeesToCsv(employees);
  }

  async findAll(query: ListEmployeesQueryDto) {
    const { page, limit, sortBy, sortOrder } = query;
    const where = this.employeeWhere(query);
    const orderBy: Prisma.EmployeeOrderByWithRelationInput[] = [
      { [sortBy]: sortOrder },
      ...(sortBy === EmployeeSortBy.ID ? [] : [{ id: SortOrder.ASC }]),
    ];
    const [data, total] = await Promise.all([
      this.prisma.employee.findMany({
        where,
        include: withDepartment,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.employee.count({ where }),
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: number) {
    const employee = await this.prisma.employee.findUnique({
      where: { id },
      include: withDepartment,
    });
    if (!employee) throw new NotFoundException('Employee not found');
    return employee;
  }

  private async requireDepartment(id: number) {
    const department = await this.prisma.department.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!department) throw new BadRequestException('Department not found');
  }

  private mapWriteError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002')
        throw new ConflictException('Employee email already exists');
      if (error.code === 'P2003')
        throw new BadRequestException('Department not found');
      if (error.code === 'P2025')
        throw new NotFoundException('Employee not found');
    }
    throw error;
  }

  async create(dto: CreateEmployeeDto, userId: number) {
    await this.requireDepartment(dto.departmentId);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const employee = await tx.employee.create({
          data: {
            name: dto.name,
            email: dto.email,
            phone: dto.phone,
            departmentId: dto.departmentId,
            status: dto.status ?? true,
          },
          include: withDepartment,
        });
        await this.auditLogs.record(
          tx,
          userId,
          'create',
          'employee',
          employee.id,
          employee,
        );
        return employee;
      });
    } catch (error) {
      this.mapWriteError(error);
    }
  }

  async update(id: number, dto: UpdateEmployeeDto, userId: number) {
    if (Object.keys(dto).length === 0)
      throw new BadRequestException('At least one field is required');
    await this.findOne(id);
    if (dto.departmentId !== undefined)
      await this.requireDepartment(dto.departmentId);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const previous = await tx.employee.findUnique({
          where: { id },
          include: withDepartment,
        });
        if (!previous) throw new NotFoundException('Employee not found');
        const employee = await tx.employee.update({
          where: { id },
          data: dto,
          include: withDepartment,
        });
        await this.auditLogs.record(
          tx,
          userId,
          'update',
          'employee',
          id,
          employee,
          previous,
        );
        return employee;
      });
    } catch (error) {
      this.mapWriteError(error);
    }
  }

  async remove(id: number, userId: number): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        const employee = await tx.employee.delete({
          where: { id },
          include: withDepartment,
        });
        await this.auditLogs.record(
          tx,
          userId,
          'delete',
          'employee',
          id,
          employee,
        );
      });
    } catch (error) {
      this.mapWriteError(error);
    }
  }
}
