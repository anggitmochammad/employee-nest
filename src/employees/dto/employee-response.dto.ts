import { ApiProperty } from '@nestjs/swagger';

class EmployeeDepartmentDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'Human Resources' })
  name: string;
}

export class EmployeeResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'Jane Doe' })
  name: string;

  @ApiProperty({ example: 'jane@example.com' })
  email: string;

  @ApiProperty({ example: '+62 812-3456-7890' })
  phone: string;

  @ApiProperty({ example: true })
  status: boolean;

  @ApiProperty({ example: 1 })
  departmentId: number;

  @ApiProperty({ type: EmployeeDepartmentDto })
  department: EmployeeDepartmentDto;
}

export class EmployeeListResponseDto {
  @ApiProperty({ type: EmployeeResponseDto, isArray: true })
  data: EmployeeResponseDto[];

  @ApiProperty({ example: 42 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;

  @ApiProperty({ example: 3 })
  totalPages: number;
}
