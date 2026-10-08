import { ApiProperty } from '@nestjs/swagger';

class AuditActorDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'Administrator' })
  name: string;

  @ApiProperty({ example: 'admin@example.com' })
  email: string;
}

export class AuditLogResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 1 })
  userId: number;

  @ApiProperty({ enum: ['create', 'update', 'delete'] })
  action: string;

  @ApiProperty({ enum: ['department', 'employee'] })
  entity: string;

  @ApiProperty({ example: 1 })
  entityId: number;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    nullable: true,
    description:
      'Data department atau employee saat aksi terjadi. Untuk audit lama, data terkini jika record masih ada.',
    example: {
      id: 1,
      name: 'Jane Doe',
      email: 'jane@example.com',
      phone: '628123456789',
      status: true,
      departmentId: 2,
      department: { id: 2, name: 'Finance' },
    },
  })
  entityData: Record<string, unknown> | null;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    nullable: true,
    description:
      'Data sebelum update. Null untuk create, delete, dan audit lama.',
  })
  previousData: Record<string, unknown> | null;

  @ApiProperty({
    enum: ['snapshot', 'current', 'unavailable'],
    description:
      'Asal entityData: snapshot historis, record terkini, atau tidak tersedia.',
  })
  entityDataSource: 'snapshot' | 'current' | 'unavailable';

  @ApiProperty({ format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ type: AuditActorDto })
  user: AuditActorDto;
}

export class AuditLogListResponseDto {
  @ApiProperty({ type: AuditLogResponseDto, isArray: true })
  data: AuditLogResponseDto[];

  @ApiProperty({ example: 42 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;

  @ApiProperty({ example: 3 })
  totalPages: number;
}
