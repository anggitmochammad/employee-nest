import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/configure-app.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { Prisma } from '../src/generated/prisma/client.js';

describe('Departments (e2e)', () => {
  let app: INestApplication<App>;
  let adminToken: string;
  let viewerToken: string;
  const department = {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
  const auditLog = { create: vi.fn() };
  const databaseError = (code: string) =>
    new Prisma.PrismaClientKnownRequestError('Database error', {
      code,
      clientVersion: 'test',
    });

  beforeAll(async () => {
    const fixture = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({
        department,
        auditLog,
        $transaction: (callback: (tx: unknown) => Promise<unknown>) =>
          callback({ department, auditLog }),
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
    Object.values(department).forEach((mock) => mock.mockReset());
    department.findFirst.mockResolvedValue(null);
    department.findUnique.mockResolvedValue({ id: 1, name: 'HR' });
    auditLog.create.mockReset();
    auditLog.create.mockResolvedValue({ id: 1 });
  });

  afterAll(async () => {
    await app?.close();
  });

  it('requires login for every operation', async () => {
    const http = request(app.getHttpServer());
    await http.get('/api/departments').expect(401);
    await http.post('/api/departments').send({ name: 'HR' }).expect(401);
    await http.patch('/api/departments/1').send({ name: 'HR' }).expect(401);
    await http.delete('/api/departments/1').expect(401);
    for (const mock of Object.values(department))
      expect(mock).not.toHaveBeenCalled();
  });

  it('allows admin and viewer to list departments, including an empty list', async () => {
    department.findMany
      .mockResolvedValueOnce([{ id: 1, name: 'HR' }])
      .mockResolvedValueOnce([]);
    await request(app.getHttpServer())
      .get('/api/departments')
      .auth(adminToken, { type: 'bearer' })
      .expect(200)
      .expect([{ id: 1, name: 'HR' }]);
    await request(app.getHttpServer())
      .get('/api/departments')
      .auth(viewerToken, { type: 'bearer' })
      .expect(200)
      .expect([]);
    expect(department.findMany).toHaveBeenNthCalledWith(1, {
      orderBy: { id: 'asc' },
    });
    expect(department.findMany).toHaveBeenNthCalledWith(2, {
      orderBy: { id: 'asc' },
    });
  });

  it('searches department names case-insensitively and keeps an array response', async () => {
    department.findMany.mockResolvedValue([{ id: 1, name: 'Human Resources' }]);

    await request(app.getHttpServer())
      .get('/api/departments?search=%20hUmAn%20')
      .auth(viewerToken, { type: 'bearer' })
      .expect(200)
      .expect([{ id: 1, name: 'Human Resources' }]);

    expect(department.findMany).toHaveBeenCalledWith({
      where: { name: { contains: 'hUmAn', mode: 'insensitive' } },
      orderBy: { id: 'asc' },
    });
  });

  it('rejects every viewer write before accessing the database', async () => {
    const http = request(app.getHttpServer());
    await http
      .post('/api/departments')
      .auth(viewerToken, { type: 'bearer' })
      .send({ name: 'HR' })
      .expect(403);
    await http
      .patch('/api/departments/1')
      .auth(viewerToken, { type: 'bearer' })
      .send({ name: 'HR' })
      .expect(403);
    await http
      .delete('/api/departments/1')
      .auth(viewerToken, { type: 'bearer' })
      .expect(403);
    for (const mock of Object.values(department))
      expect(mock).not.toHaveBeenCalled();
  });

  it('allows admin to create, rename, and delete a department', async () => {
    department.create.mockResolvedValue({ id: 1, name: 'HR' });
    department.update.mockResolvedValue({ id: 1, name: 'People' });
    department.delete.mockResolvedValue({ id: 1, name: 'People' });
    const http = request(app.getHttpServer());
    await http
      .post('/api/departments')
      .auth(adminToken, { type: 'bearer' })
      .send({ name: '  HR  ' })
      .expect(201)
      .expect({ id: 1, name: 'HR' });
    expect(department.create).toHaveBeenCalledWith({ data: { name: 'HR' } });
    await http
      .patch('/api/departments/1')
      .auth(adminToken, { type: 'bearer' })
      .send({ name: ' People ' })
      .expect(200)
      .expect({ id: 1, name: 'People' });
    expect(department.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { name: 'People' },
    });
    const removed = await http
      .delete('/api/departments/1')
      .auth(adminToken, { type: 'bearer' })
      .expect(204);
    expect(removed.text).toBe('');
    expect(auditLog.create).toHaveBeenCalledTimes(3);
    expect(auditLog.create).toHaveBeenNthCalledWith(1, {
      data: {
        userId: 1,
        action: 'create',
        entity: 'department',
        entityId: 1,
        entityData: { id: 1, name: 'HR' },
      },
    });
    expect(auditLog.create).toHaveBeenNthCalledWith(2, {
      data: {
        userId: 1,
        action: 'update',
        entity: 'department',
        entityId: 1,
        entityData: { id: 1, name: 'People' },
        previousData: { id: 1, name: 'HR' },
      },
    });
    expect(auditLog.create).toHaveBeenNthCalledWith(3, {
      data: {
        userId: 1,
        action: 'delete',
        entity: 'department',
        entityId: 1,
        entityData: { id: 1, name: 'People' },
      },
    });
  });

  it('rejects duplicate names regardless of capitalization or surrounding spaces', async () => {
    department.findFirst.mockResolvedValue({ id: 2 });
    const http = request(app.getHttpServer());
    const created = await http
      .post('/api/departments')
      .auth(adminToken, { type: 'bearer' })
      .send({ name: '  fInAnCe  ' })
      .expect(409);
    expect(created.body.message).toBe('Department name already exists');
    expect(department.findFirst).toHaveBeenCalledWith({
      where: { name: { equals: 'fInAnCe', mode: 'insensitive' } },
      select: { id: true },
    });
    const updated = await http
      .patch('/api/departments/1')
      .auth(adminToken, { type: 'bearer' })
      .send({ name: 'FINANCE' })
      .expect(409);
    expect(updated.body.message).toBe('Department name already exists');
    expect(department.findFirst).toHaveBeenLastCalledWith({
      where: {
        name: { equals: 'FINANCE', mode: 'insensitive' },
        id: { not: 1 },
      },
      select: { id: true },
    });
    expect(department.create).not.toHaveBeenCalled();
    expect(department.update).not.toHaveBeenCalled();
  });

  it.each([
    {},
    { name: '' },
    { name: '   ' },
    { name: null },
    { name: 7 },
    { name: 'HR', unexpected: true },
  ])('rejects invalid create and update bodies: %j', async (body) => {
    const http = request(app.getHttpServer());
    await http
      .post('/api/departments')
      .auth(adminToken, { type: 'bearer' })
      .send(body)
      .expect(400);
    await http
      .patch('/api/departments/1')
      .auth(adminToken, { type: 'bearer' })
      .send(body)
      .expect(400);
    expect(department.create).not.toHaveBeenCalled();
    expect(department.update).not.toHaveBeenCalled();
  });

  it.each(['abc', '0', '-1', '1.5', '2147483648'])(
    'rejects invalid ID %s',
    async (id) => {
      const http = request(app.getHttpServer());
      await http
        .patch('/api/departments/' + id)
        .auth(adminToken, { type: 'bearer' })
        .send({ name: 'HR' })
        .expect(400);
      await http
        .delete('/api/departments/' + id)
        .auth(adminToken, { type: 'bearer' })
        .expect(400);
      expect(department.update).not.toHaveBeenCalled();
      expect(department.delete).not.toHaveBeenCalled();
    },
  );

  it('returns 404 for missing departments', async () => {
    department.findUnique.mockResolvedValue(null);
    department.delete.mockRejectedValue(databaseError('P2025'));
    const http = request(app.getHttpServer());
    await http
      .patch('/api/departments/99')
      .auth(adminToken, { type: 'bearer' })
      .send({ name: 'HR' })
      .expect(404);
    const response = await http
      .delete('/api/departments/99')
      .auth(adminToken, { type: 'bearer' })
      .expect(404);
    expect(response.body).toMatchObject({
      message: 'Department not found',
      path: '/api/departments/99',
    });
    expect(department.findFirst).not.toHaveBeenCalled();
  });

  it('returns 409 when the database rejects deleting a department with employees', async () => {
    department.delete.mockRejectedValue(databaseError('P2003'));
    const response = await request(app.getHttpServer())
      .delete('/api/departments/1')
      .auth(adminToken, { type: 'bearer' })
      .expect(409);
    expect(response.body).toMatchObject({
      statusCode: 409,
      message: 'Cannot delete department that still has employees',
    });
  });

  it('documents operations, role restrictions, request body, and ID parameters', async () => {
    const { body } = await request(app.getHttpServer())
      .get('/api-documentation-json')
      .expect(200);
    const paths = body.paths;
    expect(paths['/api/departments'].get.description).toContain(
      'admin, viewer',
    );
    expect(paths['/api/departments'].get.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'search', in: 'query' }),
      ]),
    );
    expect(paths['/api/departments'].post.requestBody).toBeDefined();
    expect(paths['/api/departments/{id}'].patch.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'id', in: 'path', required: true }),
      ]),
    );
    expect(paths['/api/departments/{id}'].delete.responses).toHaveProperty(
      '409',
    );
    expect(paths['/api/departments'].post.security).toEqual([
      { 'access-token': [] },
    ]);
    expect(body.components.schemas.DepartmentDto.required).toContain('name');
  });
});
