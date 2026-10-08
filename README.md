# Employee Nest Backend

Backend sistem manajemen employee menggunakan NestJS, PostgreSQL, Prisma, JWT, dan Swagger.

Panduan ini ditujukan untuk yang baru belajar backend. Ikuti langkah dari atas ke bawah.

## 1. Persiapan

Pasang Git, Node.js versi 20 atau lebih baru, npm, dan PostgreSQL versi 14 atau lebih baru.

Periksa instalasi:

    git --version
    node --version
    npm --version
    psql --version

## 2. Clone repository

    git clone https://github.com/anggitmochammad/employee-nest.git
    cd employee-nest

## 3. Install dependency

    npm install

## 4. Buat database PostgreSQL

Buat database kosong bernama employee_db:

    createdb -U postgres employee_db

Jika createdb tidak tersedia, buka pgAdmin, klik kanan Databases, pilih Create > Database, isi nama employee_db, lalu simpan.

## 5. Buat file environment

PowerShell:

    Copy-Item .env.example .env

macOS, Linux, atau Git Bash:

    cp .env.example .env

Buka .env lalu sesuaikan:

    PORT=3000
    CORS_ORIGINS="http://localhost:5173"
    JWT_SECRET="ganti-dengan-secret-panjang-dan-acak"
    JWT_EXPIRES_IN="1h"
    ADMIN_NAME="Administrator"
    ADMIN_EMAIL="admin@example.com"
    ADMIN_PASSWORD="ganti-password-admin"
    DATABASE_URL="postgresql://postgres:postgres@localhost:5432/employee_db?schema=public"

Sesuaikan username, password, host, port, dan nama database pada DATABASE_URL. Jangan commit .env.

## 6. Jalankan migration

    npx prisma migrate deploy
    npx prisma validate

Migration membuat tabel users, departments, employees, dan audit_logs.

## 7. Masukkan data awal

    npx prisma db seed

Seed membuat akun admin, akun viewer, enam department awal (Human Resources, Finance, Information Technology, Operations, Sales, dan Marketing), serta 12 employee contoh yang terhubung ke department tersebut. Seed dapat dijalankan ulang tanpa menduplikasi employee berdasarkan email.

Akun hasil seed:

    Admin: ADMIN_EMAIL dari .env
    Viewer: viewer@example.com
    Password admin dan viewer: nilai ADMIN_PASSWORD yang sama dari .env

Akun viewer hanya dapat membaca data dan tidak dapat menjalankan aksi yang membutuhkan role admin.

## 8. Jalankan aplikasi

Mode development:

    npm run start:dev

Server tersedia di http://localhost:3000.

Perintah lain:

    npm run start
    npm run build
    npm run start:prod

## 9. Coba endpoint

Health check tidak membutuhkan login:

    curl http://localhost:3000/health

Respons:

    {
      "status": "ok",
      "database": "up"
    }

Endpoint dasar:

    curl http://localhost:3000/api

## 10. Gunakan Swagger

Buka http://localhost:3000/api-documentation.

Swagger menyediakan daftar endpoint sekaligus form untuk mencoba request:

1. Buka POST /api/auth/login.
2. Klik Try it out.
3. Isi email dan password admin.
4. Klik Send Request.
5. Salin accessToken dari response.
6. Klik Authorize.
7. Masukkan token tanpa awalan Bearer.
8. Coba endpoint lain dengan Send Request.

Swagger menampilkan parameter, body, header Authorization, HTTP status, dan response JSON.

OpenAPI JSON tersedia di http://localhost:3000/api-documentation-json.

## 11. Endpoint utama

| Method | URL                   | Akses         |
| ------ | --------------------- | ------------- |
| POST   | /api/auth/login       | Public        |
| GET    | /api/auth/me          | Login         |
| GET    | /api/departments      | Admin, viewer |
| POST   | /api/departments      | Admin         |
| PATCH  | /api/departments/:id  | Admin         |
| DELETE | /api/departments/:id  | Admin         |
| GET    | /api/employees        | Admin, viewer |
| GET    | /api/employees/:id    | Admin, viewer |
| POST   | /api/employees        | Admin         |
| PATCH  | /api/employees/:id    | Admin         |
| DELETE | /api/employees/:id    | Admin         |
| GET    | /api/employees/export | Admin, viewer |
| GET    | /api/audit-logs       | Admin         |

Audit log menampilkan `entityData` (data department atau employee saat aksi) dan `previousData` (data sebelum update). `entityDataSource` bernilai `snapshot` untuk audit baru, `current` jika audit lama mengambil record yang masih ada, atau `unavailable` jika record audit lama sudah terhapus. Jalankan migration terbaru sebelum memakai fitur ini.

## 12. Jalankan test

    npm test
    npm run test:e2e
    npm run test:cov
    npm run lint
    npm run build

## 13. Troubleshooting

### Database connection unavailable

Pastikan PostgreSQL berjalan, database employee_db sudah dibuat, DATABASE_URL benar, dan migration sudah dijalankan.

### Port 3000 sudah dipakai

Ubah PORT di .env menjadi 3001, lalu buka http://localhost:3001.

### 401 Unauthorized

Pastikan token belum kedaluwarsa dan header memakai format:

    Authorization: Bearer <access-token>

### 403 Forbidden

Token valid, tetapi role akun tidak memiliki izin. Endpoint write department, write employee, dan audit log membutuhkan admin.

## Struktur folder

    src/
    ├── auth/          login, JWT, guard, role
    ├── departments/  API department
    ├── employees/    API employee dan CSV
    ├── audit-logs/   audit log
    ├── health/       health check database
    ├── prisma/       PrismaService
    └── configure-app.ts

    prisma/
    ├── migrations/   perubahan database
    ├── schema.prisma model database
    └── seed.ts       data awal
