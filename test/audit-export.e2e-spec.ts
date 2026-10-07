import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/configure-app.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('Audit logs and CSV export (e2e)', () => {
  let app: INestApplication<App>;
  let adminToken: string;
  let viewerToken: string;
  const auditLog = { findMany: vi.fn(), count: vi.fn() };
  const employee = { findMany: vi.fn() };

  beforeAll(async () => {
    const fixture = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({
        auditLog,
        employee,
        user: {
          findUnique: vi.fn(({ where }: { where: { id: number } }) =>
            Promise.resolve({
              id: where.id,
              name: 'Test User',
              email: 'test@example.com',
              role: where.id === 1 ? 'admin' : 'viewer',
            }),
          ),
        },
      })
      .compile();
    app = fixture.createNestApplication();
    await configureApp(app);
    const jwt = fixture.get(JwtService);
    adminToken = await jwt.signAsync({ sub: 1 });
    viewerToken = await jwt.signAsync({ sub: 2 });
  });

  beforeEach(() => {
    auditLog.findMany.mockReset();
    auditLog.count.mockReset();
    employee.findMany.mockReset();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('requires authentication and makes audit history admin-only', async () => {
    const http = request(app.getHttpServer());
    await http.get('/api/audit-logs').expect(401);
    await http
      .get('/api/audit-logs')
      .auth(viewerToken, { type: 'bearer' })
      .expect(403);
    await http.get('/api/employees/export').expect(401);
    expect(auditLog.findMany).not.toHaveBeenCalled();
    expect(employee.findMany).not.toHaveBeenCalled();
  });

  it('returns paginated audit history with actor information', async () => {
    const entry = {
      id: 8,
      userId: 1,
      action: 'create',
      entity: 'employee',
      entityId: 5,
      createdAt: '2026-10-07T00:00:00.000Z',
      user: { id: 1, name: 'Administrator', email: 'admin@example.com' },
    };
    auditLog.findMany.mockResolvedValue([entry]);
    auditLog.count.mockResolvedValue(21);

    await request(app.getHttpServer())
      .get('/api/audit-logs?page=2&limit=10')
      .auth(adminToken, { type: 'bearer' })
      .expect(200)
      .expect({ data: [entry], total: 21, page: 2, limit: 10, totalPages: 3 });

    expect(auditLog.findMany).toHaveBeenCalledWith({
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: 10,
      take: 10,
    });
    expect(auditLog.count).toHaveBeenCalledWith();
    await request(app.getHttpServer())
      .get('/api/audit-logs?limit=101')
      .auth(adminToken, { type: 'bearer' })
      .expect(400);
  });

  it.each(['admin', 'viewer'])(
    'exports UTF-8 CSV for %s with escaped values',
    async (role) => {
      employee.findMany.mockResolvedValue([
        {
          id: 1,
          name: '=SUM(1,2)',
          email: 'jane@example.com',
          phone: '+628123456789',
          status: false,
          departmentId: 2,
          department: { name: 'Finance, "Ops"' },
        },
      ]);
      const token = role === 'admin' ? adminToken : viewerToken;
      const response = await request(app.getHttpServer())
        .get('/api/employees/export')
        .auth(token, { type: 'bearer' })
        .expect(200);
      expect(response.headers['content-type']).toMatch(/^text\/csv/);
      expect(response.headers['content-disposition']).toBe(
        'attachment; filename="employees.csv"',
      );
      expect(response.text).toBe(
        '\uFEFFid,name,email,phone,status,departmentId,departmentName\r\n' +
          '1,"\'=SUM(1,2)","jane@example.com","\'+628123456789",false,2,"Finance, ""Ops"""\r\n',
      );
      expect(employee.findMany).toHaveBeenCalledWith({
        include: { department: { select: { name: true } } },
        orderBy: { id: 'asc' },
      });
    },
  );

  it('exports a header when there are no employees', async () => {
    employee.findMany.mockResolvedValue([]);
    const response = await request(app.getHttpServer())
      .get('/api/employees/export')
      .auth(viewerToken, { type: 'bearer' })
      .expect(200);
    expect(response.text).toBe(
      '\uFEFFid,name,email,phone,status,departmentId,departmentName\r\n',
    );
  });

  it('documents audit and CSV endpoints in Swagger', async () => {
    const { body } = await request(app.getHttpServer())
      .get('/api-documentation-json')
      .expect(200);
    expect(body.paths).toHaveProperty('/api/audit-logs');
    expect(body.paths).toHaveProperty('/api/employees/export');
    expect(body.paths['/api/audit-logs'].get.description).toContain('admin');
    expect(
      body.paths['/api/employees/export'].get.responses['200'].content,
    ).toHaveProperty('text/csv');
  });
});
