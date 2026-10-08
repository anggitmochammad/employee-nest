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
  department: { name: string };
}

export function employeesToCsv(employees: ExportEmployee[]): string {
  const rows = [
    'id,nama,email,phone,status karyawan,nama department',
    ...employees.map((employee) =>
      [
        employee.id,
        csvText(employee.name),
        csvText(employee.email),
        // CSV tidak menyimpan tipe kolom. Apostrof memaksa spreadsheet
        // memperlakukan nomor telepon panjang sebagai teks, bukan notasi ilmiah.
        csvText(`'${employee.phone}`),
        csvText(employee.status ? 'Aktif' : 'Tidak Aktif'),
        csvText(employee.department.name),
      ].join(','),
    ),
  ];
  return '\uFEFF' + rows.join('\r\n') + '\r\n';
}
