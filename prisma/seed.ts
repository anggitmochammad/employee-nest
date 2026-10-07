import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

const databaseUrl = process.env.DATABASE_URL;
const name = process.env.ADMIN_NAME ?? 'Administrator';
const email = process.env.ADMIN_EMAIL?.toLowerCase();
const password = process.env.ADMIN_PASSWORD;

const departmentNames = [
  'Human Resources',
  'Finance',
  'Information Technology',
  'Operations',
  'Sales',
  'Marketing',
];

if (!databaseUrl || !email || !password) {
  throw new Error(
    'DATABASE_URL, ADMIN_EMAIL, and ADMIN_PASSWORD must be set before seeding',
  );
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

async function main() {
  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.upsert({
    where: { email },
    update: { name, password: passwordHash, role: 'admin' },
    create: { name, email, password: passwordHash, role: 'admin' },
  });

  console.log(`Admin account is ready: ${email}`);

  // Nama department belum memiliki unique constraint, sehingga upsert berdasarkan
  // nama tidak tersedia. Cek dahulu agar seed ulang tidak menambah nama yang sama.
  for (const departmentName of departmentNames) {
    const existing = await prisma.department.findFirst({
      where: { name: { equals: departmentName, mode: 'insensitive' } },
    });

    if (!existing) {
      await prisma.department.create({ data: { name: departmentName } });
    }
  }

  console.log(`Default departments are ready: ${departmentNames.length}`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
