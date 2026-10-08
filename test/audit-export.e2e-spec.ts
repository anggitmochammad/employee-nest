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
  const department = { findMany: vi.fn() };
  const user = {
    findMany: vi.fn(),
    findUnique: vi.fn(({ where }: { where: { id: number } }) =>
      Promise.resolve({
        id: where.id,
        name: 'Test User',
        email: 'test@example.com',
        role: where.id === 1 ? 'admin' : 'viewer',
      }),
    ),
  };

  beforeAll(async () => {
    const fixture = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({
        auditLog,
        employee,
        department,
        user,
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
    department.findMany.mockReset();
    user.findMany.mockReset();
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
    await http.get('/api/audit-logs/users').expect(401);
    await http
      .get('/api/audit-logs/users')
      .auth(viewerToken, { type: 'bearer' })
      .expect(403);
    await http.get('/api/employees/export').expect(401);
    expect(auditLog.findMany).not.toHaveBeenCalled();
    expect(user.findMany).not.toHaveBeenCalled();
    expect(employee.findMany).not.toHaveBeenCalled();
  });

  it('returns paginated audit history with actor information', async () => {
    const entry = {
      id: 8,
      userId: 1,
      action: 'create',
      entity: 'employee',
      entityId: 5,
      entityData: { id: 5, name: 'Jane Doe', email: 'jane@example.com' },
      createdAt: '2026-10-07T00:00:00.000Z',
      user: { id: 1, name: 'Administrator', email: 'admin@example.com' },
    };
    auditLog.findMany.mockResolvedValue([entry]);
    auditLog.count.mockResolvedValue(21);

    await request(app.getHttpServer())
      .get('/api/audit-logs?page=2&limit=10')
      .auth(adminToken, { type: 'bearer' })
      .expect(200)
      .expect({
        data: [{ ...entry, entityDataSource: 'snapshot' }],
        total: 21,
        page: 2,
        limit: 10,
        totalPages: 3,
      });

    expect(auditLog.findMany).toHaveBeenCalledWith({
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: 10,
      take: 10,
    });
    expect(auditLog.count).toHaveBeenCalledWith();
    expect(employee.findMany).not.toHaveBeenCalled();
    await request(app.getHttpServer())
      .get('/api/audit-logs?limit=101')
      .auth(adminToken, { type: 'bearer' })
      .expect(400);
  });

  it('filters before pagination and sorts stably in the requested direction', async () => {
    auditLog.findMany.mockResolvedValue([]);
    auditLog.count.mockResolvedValue(0);

    await request(app.getHttpServer())
      .get(
        '/api/audit-logs?page=2&limit=15&action=update&userId=3&startDate=2026-10-01&endDate=2026-10-08&sortOrder=asc',
      )
      .auth(adminToken, { type: 'bearer' })
      .expect(200)
      .expect({ data: [], total: 0, page: 2, limit: 15, totalPages: 0 });

    const where = {
      action: 'update',
      userId: 3,
      createdAt: {
        gte: new Date('2026-09-30T17:00:00.000Z'),
        lt: new Date('2026-10-08T17:00:00.000Z'),
      },
    };
    expect(auditLog.findMany).toHaveBeenCalledWith({
      where,
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      skip: 15,
      take: 15,
    });
    expect(auditLog.count).toHaveBeenCalledWith({ where });
  });

  it.each([
    'action=read',
    'userId=0',
    'userId=1.5',
    'startDate=01-10-2026',
    'startDate=2026-02-30',
    'endDate=2026-10-08T00:00:00Z',
    'sortOrder=newest',
    'startDate=2026-10-09&endDate=2026-10-08',
  ])('rejects invalid audit filter %s', async (query) => {
    await request(app.getHttpServer())
      .get(`/api/audit-logs?${query}`)
      .auth(adminToken, { type: 'bearer' })
      .expect(400);
    expect(auditLog.findMany).not.toHaveBeenCalled();
    expect(auditLog.count).not.toHaveBeenCalled();
  });

  it('returns every user that has audit history', async () => {
    const actors = [
      { id: 1, name: 'Administrator', email: 'admin@example.com' },
      { id: 3, name: 'Operator', email: 'operator@example.com' },
    ];
    user.findMany.mockResolvedValue(actors);

    await request(app.getHttpServer())
      .get('/api/audit-logs/users')
      .auth(adminToken, { type: 'bearer' })
      .expect(200)
      .expect(actors);

    expect(user.findMany).toHaveBeenCalledWith({
      where: { auditLogs: { some: {} } },
      select: { id: true, name: true, email: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
  });

  it('resolves legacy audit data from the correct entity table', async () => {
    auditLog.findMany.mockResolvedValue([
      { id: 1, entity: 'department', entityId: 2, entityData: null },
      { id: 2, entity: 'employee', entityId: 2, entityData: null },
      { id: 3, entity: 'employee', entityId: 99, entityData: null },
    ]);
    auditLog.count.mockResolvedValue(3);
    department.findMany.mockResolvedValue([{ id: 2, name: 'Finance' }]);
    employee.findMany.mockResolvedValue([{ id: 2, name: 'Jane Doe' }]);

    const { body } = await request(app.getHttpServer())
      .get('/api/audit-logs')
      .auth(adminToken, { type: 'bearer' })
      .expect(200);
    expect(body.data).toEqual([
      expect.objectContaining({
        entityData: { id: 2, name: 'Finance' },
        entityDataSource: 'current',
      }),
      expect.objectContaining({
        entityData: { id: 2, name: 'Jane Doe' },
        entityDataSource: 'current',
      }),
      expect.objectContaining({
        entityData: null,
        entityDataSource: 'unavailable',
      }),
    ]);
  });

  it.each(['admin', 'viewer'])(
    'exports UTF-8 CSV for %s with escaped values',
    async (role) => {
      employee.findMany.mockResolvedValue([
        {
          id: 1,
          name: '=SUM(1,2)',
          email: 'jane@example.com',
          phone: '628123456789',
          status: false,
          departmentId: 2,
          department: { name: 'Finance, "Ops"' },
        },
        {
          id: 2,
          name: 'John Doe',
          email: 'john@example.com',
          phone: '628123456780',
          status: true,
          departmentId: 3,
          department: { name: 'Technology' },
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
        '\uFEFFid,nama,email,phone,status karyawan,nama department\r\n' +
          '1,"\'=SUM(1,2)","jane@example.com","\'628123456789","Tidak Aktif","Finance, ""Ops"""\r\n' +
          '2,"John Doe","john@example.com","\'628123456780","Aktif","Technology"\r\n',
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
      '\uFEFFid,nama,email,phone,status karyawan,nama department\r\n',
    );
  });

  it('documents audit and CSV endpoints in Swagger', async () => {
    const { body } = await request(app.getHttpServer())
      .get('/api-documentation-json')
      .expect(200);
    expect(body.paths).toHaveProperty('/api/audit-logs');
    expect(body.paths).toHaveProperty('/api/audit-logs/users');
    expect(body.paths).toHaveProperty('/api/employees/export');
    expect(body.paths['/api/audit-logs'].get.description).toContain('admin');
    expect(body.paths['/api/audit-logs'].get.parameters).toEqual(
      expect.arrayContaining(
        ['action', 'userId', 'startDate', 'endDate', 'sortOrder'].map((name) =>
          expect.objectContaining({ name, in: 'query' }),
        ),
      ),
    );
    expect(
      body.paths['/api/employees/export'].get.responses['200'].content,
    ).toHaveProperty('text/csv');
  });
});
