import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';

export class ListDepartmentsQueryDto {
  @ApiPropertyOptional({
    example: 'human',
    description:
      'Pencarian sebagian nama department tanpa membedakan huruf besar-kecil.',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsOptional()
  @IsString()
  search?: string;
}
