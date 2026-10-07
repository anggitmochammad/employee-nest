import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export enum EmployeeSortBy {
  ID = 'id',
  NAME = 'name',
  EMAIL = 'email',
  STATUS = 'status',
  DEPARTMENT_ID = 'departmentId',
}

export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

export class ListEmployeesQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  // Dengan limit maksimal 100, offset tetap muat dalam integer PostgreSQL.
  @Max(21474836)
  page: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  @ApiPropertyOptional({
    description: 'Cari nama atau email, tanpa membedakan kapital',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ example: 1, minimum: 1 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2147483647)
  departmentId?: number;

  @ApiPropertyOptional({ example: true, description: 'Hanya true atau false' })
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsOptional()
  @IsBoolean()
  status?: boolean;

  @ApiPropertyOptional({ enum: EmployeeSortBy, default: EmployeeSortBy.ID })
  @IsOptional()
  @IsEnum(EmployeeSortBy)
  sortBy: EmployeeSortBy = EmployeeSortBy.ID;

  @ApiPropertyOptional({ enum: SortOrder, default: SortOrder.ASC })
  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder: SortOrder = SortOrder.ASC;
}
