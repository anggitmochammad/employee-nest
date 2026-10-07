// Kutip setiap nilai teks; awalan apostrof mencegah formula berjalan saat CSV dibuka di spreadsheet.
function csvText(value: string): string {
  const safe = /^\s*[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}

export interface ExportEmployee {
  id: number;
  name: string;
  email: string;
  phone: string;
  status: boolean;
  departmentId: number;
  department: { name: string };
}

export function employeesToCsv(employees: ExportEmployee[]): string {
  const rows = [
    'id,name,email,phone,status,departmentId,departmentName',
    ...employees.map((employee) =>
      [
        employee.id,
        csvText(employee.name),
        csvText(employee.email),
        csvText(employee.phone),
        employee.status,
        employee.departmentId,
        csvText(employee.department.name),
      ].join(','),
    ),
  ];
  return '\uFEFF' + rows.join('\r\n') + '\r\n';
}
