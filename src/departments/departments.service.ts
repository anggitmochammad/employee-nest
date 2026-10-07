import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditLogsService } from '../audit-logs/audit-logs.service.js';
import type { DepartmentDto } from './dto/department.dto.js';

@Injectable()
export class DepartmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  findAll() {
    return this.prisma.department.findMany({ orderBy: { id: 'asc' } });
  }

  private async ensureNameAvailable(name: string, exceptId?: number) {
    const existing = await this.prisma.department.findFirst({
      where: {
        name: { equals: name, mode: 'insensitive' },
        ...(exceptId === undefined ? {} : { id: { not: exceptId } }),
      },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException('Department name already exists');
    }
  }

  async create(dto: DepartmentDto, userId: number) {
    await this.ensureNameAvailable(dto.name);
    return this.prisma.$transaction(async (tx) => {
      const department = await tx.department.create({
        data: { name: dto.name },
      });
      await this.auditLogs.record(
        tx,
        userId,
        'create',
        'department',
        department.id,
      );
      return department;
    });
  }

  async update(id: number, dto: DepartmentDto, userId: number) {
    const current = await this.prisma.department.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!current) {
      throw new NotFoundException('Department not found');
    }

    await this.ensureNameAvailable(dto.name, id);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const department = await tx.department.update({
          where: { id },
          data: { name: dto.name },
        });
        await this.auditLogs.record(tx, userId, 'update', 'department', id);
        return department;
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException('Department not found');
      }
      throw error;
    }
  }

  async remove(id: number, userId: number): Promise<void> {
    try {
      // Foreign key RESTRICT memeriksa relasi secara atomik saat DELETE.
      // Employee yang masuk bersamaan tidak dapat menyebabkan data yatim.
      await this.prisma.$transaction(async (tx) => {
        await tx.department.delete({ where: { id } });
        await this.auditLogs.record(tx, userId, 'delete', 'department', id);
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new NotFoundException('Department not found');
        }
        if (error.code === 'P2003') {
          throw new ConflictException(
            'Cannot delete department that still has employees',
          );
        }
      }
      throw error;
    }
  }
}
