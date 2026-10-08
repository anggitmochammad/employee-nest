import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ListAuditLogsQueryDto } from './dto/list-audit-logs-query.dto.js';

export type AuditAction = 'create' | 'update' | 'delete';
export type AuditEntity = 'department' | 'employee';

// Asia/Jakarta selalu UTC+7 dan tidak memakai daylight saving time.
function jakartaDateBoundary(date: string, dayOffset = 0): Date {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + dayOffset, -7));
}

@Injectable()
export class AuditLogsService {
  constructor(private readonly prisma: PrismaService) {}

  // Dipanggil dengan transaction client yang sama dengan operasi data.
  record(
    tx: Prisma.TransactionClient,
    userId: number,
    action: AuditAction,
    entity: AuditEntity,
    entityId: number,
    entityData: Prisma.InputJsonValue,
    previousData?: Prisma.InputJsonValue,
  ) {
    return tx.auditLog.create({
      data: {
        userId,
        action,
        entity,
        entityId,
        entityData,
        ...(previousData === undefined ? {} : { previousData }),
      },
    });
  }

  async findAll(query: ListAuditLogsQueryDto) {
    const { page, limit, action, userId, startDate, endDate, sortOrder } =
      query;
    if (startDate && endDate && startDate > endDate) {
      throw new BadRequestException('startDate must not be after endDate');
    }

    const where: Prisma.AuditLogWhereInput = {
      ...(action ? { action } : {}),
      ...(userId === undefined ? {} : { userId }),
      ...(startDate || endDate
        ? {
            createdAt: {
              ...(startDate ? { gte: jakartaDateBoundary(startDate) } : {}),
              ...(endDate ? { lt: jakartaDateBoundary(endDate, 1) } : {}),
            },
          }
        : {}),
    };
    const hasFilters = Object.keys(where).length > 0;
    const filter: { where?: Prisma.AuditLogWhereInput } = hasFilters
      ? { where }
      : {};
    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        ...filter,
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: [{ createdAt: sortOrder }, { id: sortOrder }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      hasFilters
        ? this.prisma.auditLog.count({ where })
        : this.prisma.auditLog.count(),
    ]);

    // Audit lama belum memiliki snapshot. Ambil record yang masih ada sesuai tabelnya.
    const legacy = data.filter((entry) => entry.entityData == null);
    const [departments, employees] = await Promise.all([
      legacy.some((entry) => entry.entity === 'department')
        ? this.prisma.department.findMany({
            where: {
              id: {
                in: legacy
                  .filter((entry) => entry.entity === 'department')
                  .map((entry) => entry.entityId),
              },
            },
            select: { id: true, name: true },
          })
        : [],
      legacy.some((entry) => entry.entity === 'employee')
        ? this.prisma.employee.findMany({
            where: {
              id: {
                in: legacy
                  .filter((entry) => entry.entity === 'employee')
                  .map((entry) => entry.entityId),
              },
            },
            include: {
              department: { select: { id: true, name: true } },
            },
          })
        : [],
    ]);
    const departmentById = new Map(departments.map((item) => [item.id, item]));
    const employeeById = new Map(employees.map((item) => [item.id, item]));
    const logs = data.map((entry) => {
      const current =
        entry.entity === 'department'
          ? departmentById.get(entry.entityId)
          : entry.entity === 'employee'
            ? employeeById.get(entry.entityId)
            : undefined;
      return {
        ...entry,
        entityData: entry.entityData ?? current ?? null,
        entityDataSource:
          entry.entityData != null
            ? 'snapshot'
            : current
              ? 'current'
              : 'unavailable',
      };
    });
    return {
      data: logs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  findActors() {
    return this.prisma.user.findMany({
      where: { auditLogs: { some: {} } },
      select: { id: true, name: true, email: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
  }
}
