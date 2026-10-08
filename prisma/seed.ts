import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

const databaseUrl = process.env.DATABASE_URL;
const name = process.env.ADMIN_NAME ?? 'Administrator';
const email = process.env.ADMIN_EMAIL?.toLowerCase();
const password = process.env.ADMIN_PASSWORD;
const viewerEmail = 'viewer@example.com';

const departmentNames = [
  'Human Resources',
  'Finance',
  'Information Technology',
  'Operations',
  'Sales',
  'Marketing',
];

const employeeSeeds = [
  {
    name: 'Andi Pratama',
    email: 'andi.pratama@example.com',
    phone: '6281234567801',
    department: 'Human Resources',
  },
  {
    name: 'Siti Rahmawati',
    email: 'siti.rahmawati@example.com',
    phone: '6281234567802',
    department: 'Human Resources',
  },
  {
    name: 'Budi Santoso',
    email: 'budi.santoso@example.com',
    phone: '6281234567803',
    department: 'Finance',
  },
  {
    name: 'Dewi Anggraini',
    email: 'dewi.anggraini@example.com',
    phone: '6281234567804',
    department: 'Finance',
  },
  {
    name: 'Rizky Saputra',
    email: 'rizky.saputra@example.com',
    phone: '6281234567805',
    department: 'Information Technology',
  },
  {
    name: 'Nadia Putri',
    email: 'nadia.putri@example.com',
    phone: '6281234567806',
    department: 'Information Technology',
  },
  {
    name: 'Fajar Maulana',
    email: 'fajar.maulana@example.com',
    phone: '6281234567807',
    department: 'Operations',
  },
  {
    name: 'Intan Permata',
    email: 'intan.permata@example.com',
    phone: '6281234567808',
    department: 'Operations',
  },
  {
    name: 'Arif Hidayat',
    email: 'arif.hidayat@example.com',
    phone: '6281234567809',
    department: 'Sales',
  },
  {
    name: 'Maya Lestari',
    email: 'maya.lestari@example.com',
    phone: '6281234567810',
    department: 'Sales',
  },
  {
    name: 'Dimas Nugroho',
    email: 'dimas.nugroho@example.com',
    phone: '6281234567811',
    department: 'Marketing',
  },
  {
    name: 'Rina Kurnia',
    email: 'rina.kurnia@example.com',
    phone: '6281234567812',
    department: 'Marketing',
  },
];

if (!databaseUrl || !email || !password) {
  throw new Error(
    'DATABASE_URL, ADMIN_EMAIL, and ADMIN_PASSWORD must be set before seeding',
  );
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

async function main(adminEmail: string, adminPassword: string) {
  const passwordHash = await bcrypt.hash(adminPassword, 12);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { name, password: passwordHash, role: 'admin' },
    create: { name, email: adminEmail, password: passwordHash, role: 'admin' },
  });

  console.log(`Admin account is ready: ${adminEmail}`);

  await prisma.user.upsert({
    where: { email: viewerEmail },
    update: { name: 'Viewer', password: passwordHash, role: 'viewer' },
    create: {
      name: 'Viewer',
      email: viewerEmail,
      password: passwordHash,
      role: 'viewer',
    },
  });

  console.log(`Viewer account is ready: ${viewerEmail}`);

  // Nama department belum memiliki unique constraint, sehingga upsert berdasarkan
  // nama tidak tersedia. Cek dahulu agar seed ulang tidak menambah nama yang sama.
  const departmentIds = new Map<string, number>();
  for (const departmentName of departmentNames) {
    const existing = await prisma.department.findFirst({
      where: { name: { equals: departmentName, mode: 'insensitive' } },
    });

    const department =
      existing ??
      (await prisma.department.create({ data: { name: departmentName } }));
    departmentIds.set(departmentName, department.id);
  }

  console.log(`Default departments are ready: ${departmentNames.length}`);

  const employees = employeeSeeds.map(({ department, ...employee }) => {
    const departmentId = departmentIds.get(department);
    if (departmentId === undefined) {
      throw new Error(`Seed department not found: ${department}`);
    }
    return { ...employee, departmentId };
  });

  await prisma.employee.createMany({ data: employees, skipDuplicates: true });
  console.log(`Default employees are ready: ${employeeSeeds.length}`);
}

main(email, password)
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
