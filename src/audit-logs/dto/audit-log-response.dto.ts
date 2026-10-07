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
