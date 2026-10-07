import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/configure-app.js';
import { Prisma } from '../src/generated/prisma/client.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('Employees (e2e)', () => {
  let app: INestApplication<App>;
  let adminToken: string;
  let viewerToken: string;
  const employee = {
    findMany: vi.fn(),
    count: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
  const department = { findUnique: vi.fn() };
  const auditLog = { create: vi.fn() };
  const record = {
    id: 1,
    name: 'Jane Doe',
    email: 'jane@example.com',
    phone: '+628123456789',
    status: true,
    departmentId: 2,
    department: { id: 2, name: 'Finance' },
  };
  const error = (code: string) =>
    new Prisma.PrismaClientKnownRequestError('Database error', {
      code,
      clientVersion: 'test',
    });

  beforeAll(async () => {
    const fixture = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({
        employee,
        department,
        auditLog,
        $transaction: (callback: (tx: unknown) => Promise<unknown>) =>
          callback({ employee, auditLog }),
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
    Object.values(employee).forEach((mock) => mock.mockReset());
    department.findUnique.mockReset();
    department.findUnique.mockResolvedValue({ id: 2 });
    employee.findUnique.mockResolvedValue(record);
    auditLog.create.mockReset();
    auditLog.create.mockResolvedValue({ id: 1 });
  });

  afterAll(async () => {
    await app?.close();
  });

  it('requires a token and limits writes to admin', async () => {
    const http = request(app.getHttpServer());
    await http.get('/api/employees').expect(401);
    await http.get('/api/employees/1').expect(401);
    await http.post('/api/employees').send(record).expect(401);
    await http.patch('/api/employees/1').send({ name: 'Jane' }).expect(401);
    await http.delete('/api/employees/1').expect(401);
    await http
      .post('/api/employees')
      .auth(viewerToken, { type: 'bearer' })
      .send(record)
      .expect(403);
    await http
      .patch('/api/employees/1')
      .auth(viewerToken, { type: 'bearer' })
      .send({ name: 'Jane' })
      .expect(403);
    await http
      .delete('/api/employees/1')
      .auth(viewerToken, { type: 'bearer' })
      .expect(403);
    expect(employee.create).not.toHaveBeenCalled();
    expect(employee.update).not.toHaveBeenCalled();
    expect(employee.delete).not.toHaveBeenCalled();
  });

  it('lists employees with defaults and lets viewer read details', async () => {
    employee.findMany.mockResolvedValue([record]);
    employee.count.mockResolvedValue(1);
    const http = request(app.getHttpServer());
    await http
      .get('/api/employees')
      .auth(viewerToken, { type: 'bearer' })
      .expect(200)
      .expect({ data: [record], total: 1, page: 1, limit: 20, totalPages: 1 });
    expect(employee.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {},
        orderBy: [{ id: 'asc' }],
        skip: 0,
        take: 20,
      }),
    );
    await http
      .get('/api/employees/1')
      .auth(viewerToken, { type: 'bearer' })
      .expect(200)
      .expect(record);
  });

  it('passes search, filters, pagination and sorting to Prisma', async () => {
    employee.findMany.mockResolvedValue([]);
    employee.count.mockResolvedValue(21);
    await request(app.getHttpServer())
      .get(
        '/api/employees?page=2&limit=10&search=Jane&departmentId=2&status=false&sortBy=name&sortOrder=desc',
      )
      .auth(adminToken, { type: 'bearer' })
      .expect(200)
      .expect({ data: [], total: 21, page: 2, limit: 10, totalPages: 3 });
    const where = {
      OR: [
        { name: { contains: 'Jane', mode: 'insensitive' } },
        { email: { contains: 'Jane', mode: 'insensitive' } },
      ],
      departmentId: 2,
      status: false,
    };
    expect(employee.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where,
        orderBy: [{ name: 'desc' }, { id: 'asc' }],
        skip: 10,
        take: 10,
      }),
    );
    expect(employee.count).toHaveBeenCalledWith({ where });
  });

  it.each([
    '?page=0',
    '?limit=101',
    '?departmentId=abc',
    '?status=maybe',
    '?sortBy=password',
    '?sortOrder=random',
  ])('rejects invalid list query %s', async (query) => {
    await request(app.getHttpServer())
      .get('/api/employees' + query)
      .auth(adminToken, { type: 'bearer' })
      .expect(400);
    expect(employee.findMany).not.toHaveBeenCalled();
  });

  it('creates with normalized email and default active status', async () => {
    employee.create.mockResolvedValue(record);
    const response = await request(app.getHttpServer())
      .post('/api/employees')
      .auth(adminToken, { type: 'bearer' })
      .send({
        name: ' Jane Doe ',
        email: ' JANE@EXAMPLE.COM ',
        phone: '+628123456789',
        departmentId: 2,
      })
      .expect(201);
    expect(response.body).toEqual(record);
    expect(employee.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          name: 'Jane Doe',
          email: 'jane@example.com',
          phone: '+628123456789',
          departmentId: 2,
          status: true,
        },
      }),
    );
    expect(auditLog.create).toHaveBeenCalledWith({
      data: { userId: 1, action: 'create', entity: 'employee', entityId: 1 },
    });
  });

  it.each([
    {
      name: '',
      email: 'jane@example.com',
      phone: '+628123456789',
      departmentId: 2,
    },
    { name: 'Jane', email: 'wrong', phone: '+628123456789', departmentId: 2 },
    { name: 'Jane', email: 'jane@example.com', phone: 'abc', departmentId: 2 },
    {
      name: 'Jane',
      email: 'jane@example.com',
      phone: '+628123456789',
      departmentId: 0,
    },
    {
      name: 'Jane',
      email: 'jane@example.com',
      phone: '+628123456789',
      departmentId: 2,
      status: 'yes',
    },
    {
      name: 'Jane',
      email: 'jane@example.com',
      phone: '+628123456789',
      departmentId: 2,
      status: null,
    },
  ])('rejects invalid employee body %j', async (body) => {
    await request(app.getHttpServer())
      .post('/api/employees')
      .auth(adminToken, { type: 'bearer' })
      .send(body)
      .expect(400);
    expect(employee.create).not.toHaveBeenCalled();
  });

  it('rejects missing department and duplicate email', async () => {
    department.findUnique.mockResolvedValueOnce(null);
    const http = request(app.getHttpServer());
    await http
      .post('/api/employees')
      .auth(adminToken, { type: 'bearer' })
      .send({
        name: 'Jane',
        email: 'jane@example.com',
        phone: '+628123456789',
        departmentId: 99,
      })
      .expect(400);
    employee.create.mockRejectedValue(error('P2002'));
    const duplicate = await http
      .post('/api/employees')
      .auth(adminToken, { type: 'bearer' })
      .send({
        name: 'Jane',
        email: 'jane@example.com',
        phone: '+628123456789',
        departmentId: 2,
      })
      .expect(409);
    expect(duplicate.body.message).toBe('Employee email already exists');
  });

  it('updates selected fields, rejects empty patch, and deletes', async () => {
    employee.update.mockResolvedValue({ ...record, status: false });
    employee.delete.mockResolvedValue(record);
    const http = request(app.getHttpServer());
    await http
      .patch('/api/employees/1')
      .auth(adminToken, { type: 'bearer' })
      .send({ status: false })
      .expect(200)
      .expect({ ...record, status: false });
    expect(employee.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        data: { status: false },
      }),
    );
    await http
      .patch('/api/employees/1')
      .auth(adminToken, { type: 'bearer' })
      .send({})
      .expect(400);
    await http
      .patch('/api/employees/1')
      .auth(adminToken, { type: 'bearer' })
      .send({ name: null })
      .expect(400);
    await http
      .patch('/api/employees/1')
      .auth(adminToken, { type: 'bearer' })
      .send({ status: null })
      .expect(400);
    await http
      .delete('/api/employees/1')
      .auth(adminToken, { type: 'bearer' })
      .expect(204);
    expect(auditLog.create).toHaveBeenCalledTimes(2);
    expect(auditLog.create).toHaveBeenNthCalledWith(1, {
      data: { userId: 1, action: 'update', entity: 'employee', entityId: 1 },
    });
    expect(auditLog.create).toHaveBeenNthCalledWith(2, {
      data: { userId: 1, action: 'delete', entity: 'employee', entityId: 1 },
    });
  });

  it('returns 404 for missing employees and rejects invalid IDs', async () => {
    const http = request(app.getHttpServer());
    employee.findUnique.mockResolvedValue(null);
    await http
      .get('/api/employees/99')
      .auth(viewerToken, { type: 'bearer' })
      .expect(404);
    await http
      .patch('/api/employees/99')
      .auth(adminToken, { type: 'bearer' })
      .send({ name: 'Jane' })
      .expect(404);
    employee.delete.mockRejectedValue(error('P2025'));
    await http
      .delete('/api/employees/99')
      .auth(adminToken, { type: 'bearer' })
      .expect(404);
    await http
      .get('/api/employees/abc')
      .auth(viewerToken, { type: 'bearer' })
      .expect(400);
  });

  it('documents employees in Swagger', async () => {
    const { body } = await request(app.getHttpServer())
      .get('/api-documentation-json')
      .expect(200);
    expect(body.paths).toHaveProperty('/api/employees');
    expect(body.paths).toHaveProperty('/api/employees/{id}');
    expect(
      body.paths['/api/employees'].get.parameters.map(
        (item: { name: string }) => item.name,
      ),
    ).toEqual(
      expect.arrayContaining([
        'page',
        'limit',
        'search',
        'departmentId',
        'status',
        'sortBy',
        'sortOrder',
      ]),
    );
  });
});
