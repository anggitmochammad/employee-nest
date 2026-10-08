import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  Matches,
  Max,
  Min,
  IsOptional,
} from 'class-validator';

export enum AuditActionFilter {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
}

export enum AuditSortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

export class ListAuditLogsQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(21474836)
  page: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  @ApiPropertyOptional({ enum: AuditActionFilter })
  @IsOptional()
  @IsEnum(AuditActionFilter)
  action?: AuditActionFilter;

  @ApiPropertyOptional({ minimum: 1, example: 3 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2147483647)
  userId?: number;

  @ApiPropertyOptional({ format: 'date', example: '2026-10-01' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true, strictSeparator: true })
  startDate?: string;

  @ApiPropertyOptional({ format: 'date', example: '2026-10-08' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true, strictSeparator: true })
  endDate?: string;

  @ApiPropertyOptional({ enum: AuditSortOrder, default: AuditSortOrder.DESC })
  @IsOptional()
  @IsEnum(AuditSortOrder)
  sortOrder: AuditSortOrder = AuditSortOrder.DESC;
}
