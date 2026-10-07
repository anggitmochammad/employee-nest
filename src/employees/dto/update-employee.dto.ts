import { PartialType } from '@nestjs/swagger';
import { CreateEmployeeDto } from './create-employee.dto.js';

// Field boleh absen, tetapi null tetap harus gagal validasi.
export class UpdateEmployeeDto extends PartialType(CreateEmployeeDto, {
  skipNullProperties: false,
}) {}
