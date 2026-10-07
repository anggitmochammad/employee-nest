import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ListAuditLogsQueryDto } from './dto/list-audit-logs-query.dto.js';

export type AuditAction = 'create' | 'update' | 'delete';
export type AuditEntity = 'department' | 'employee';

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
  ) {
    return tx.auditLog.create({
      data: { userId, action, entity, entityId },
    });
  }

  async findAll(query: ListAuditLogsQueryDto) {
    const { page, limit } = query;
    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.auditLog.count(),
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }
}
