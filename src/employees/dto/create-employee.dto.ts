import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsString,
  Matches,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

export class CreateEmployeeDto {
  @ApiProperty({ example: 'Jane Doe' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'jane@example.com' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  email: string;

  @ApiProperty({
    example: '+62 812-3456-7890',
    description: 'Nomor seluler Indonesia. Disimpan sebagai 628xxxxxxxxxx.',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string'
      ? (() => {
          const compact = value.replace(/[ ()-]/g, '');
          if (compact.startsWith('+62')) return compact.slice(1);
          if (compact.startsWith('0')) return `62${compact.slice(1)}`;
          return compact;
        })()
      : value,
  )
  @IsString()
  // Format canonical: 628xxxxxxxxx, dengan prefix seluler Indonesia 08xx.
  @Matches(/^628[1-9][0-9]{7,10}$/, {
    message: 'phone must be a valid Indonesian mobile number',
  })
  phone: string;

  @ApiProperty({ example: 1, minimum: 1, maximum: 2147483647 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2147483647)
  departmentId: number;

  @ApiPropertyOptional({ example: true, default: true })
  @ValidateIf(
    (_object: CreateEmployeeDto, value: unknown) => value !== undefined,
  )
  @IsBoolean()
  status?: boolean;
}
