import { PickType } from '@nestjs/swagger';
import { ListEmployeesQueryDto } from './list-employees-query.dto.js';

export class ExportEmployeesQueryDto extends PickType(ListEmployeesQueryDto, [
  'search',
  'departmentId',
  'status',
] as const) {}
