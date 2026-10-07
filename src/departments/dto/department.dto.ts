import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';

// Create dan update sama-sama mewajibkan nama; body kosong ditolak.
export class DepartmentDto {
  @ApiProperty({
    example: 'Human Resources',
    description: 'Nama department; spasi di awal dan akhir dihapus.',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  name: string;
}
