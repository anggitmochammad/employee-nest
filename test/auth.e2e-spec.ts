import { Controller, Get, INestApplication, UseGuards } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { Role } from '../src/auth/auth.types.js';
import { Roles } from '../src/auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../src/auth/guards/roles.guard.js';
import { configureApp } from '../src/configure-app.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

@Controller('test-role')
@UseGuards(JwtAuthGuard, RolesGuard)
class RoleTestController {
  @Get('admin')
  @Roles(Role.ADMIN)
  adminOnly() {
    return { allowed: true };
  }
}

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let adminPasswordHash: string;
  let viewerPasswordHash: string;

  const users = [
    {
      id: 1,
      name: 'Administrator',
      email: 'admin@example.com',
      get password() {
        return adminPasswordHash;
      },
      role: Role.ADMIN,
    },
    {
      id: 2,
      name: 'Viewer',
      email: 'viewer@example.com',
      get password() {
        return viewerPasswordHash;
      },
      role: Role.VIEWER,
    },
  ];

  beforeAll(async () => {
    adminPasswordHash = await bcrypt.hash('admin-password', 4);
    viewerPasswordHash = await bcrypt.hash('viewer-password', 4);

    const findUnique = vi.fn(
      ({ where }: { where: { id?: number; email?: string } }) =>
        Promise.resolve(
          users.find(
            (user) =>
              (where.id !== undefined && user.id === where.id) ||
              (where.email !== undefined && user.email === where.email),
          ) ?? null,
        ),
    );

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [RoleTestController],
    })
      .overrideProvider(PrismaService)
      .useValue({
        $queryRaw: vi.fn().mockResolvedValue([{ value: 1 }]),
        user: { findUnique },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    await configureApp(app);
  });

  function login(email: string, password: string) {
    return request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password });
  }

  it('logs in with valid credentials without exposing the password', async () => {
    const response = await login('ADMIN@example.com', 'admin-password').expect(
      200,
    );

    expect(response.body).toMatchObject({
      accessToken: expect.any(String),
      tokenType: 'Bearer',
      user: {
        id: 1,
        name: 'Administrator',
        email: 'admin@example.com',
        role: Role.ADMIN,
      },
    });
    expect(response.body.user.password).toBeUndefined();
  });

  it('rejects invalid credentials and invalid request bodies', async () => {
    await login('admin@example.com', 'wrong-password').expect(401);

    const invalid = await login('not-an-email', 'short').expect(400);
    expect(invalid.body).toMatchObject({
      message: 'Validation failed',
      errors: expect.arrayContaining([
        'email must be an email',
        'password must be longer than or equal to 8 characters',
      ]),
    });
  });

  it('returns the current user for a valid bearer token', async () => {
    await request(app.getHttpServer()).get('/api/auth/me').expect(401);

    const loginResponse = await login(
      'viewer@example.com',
      'viewer-password',
    ).expect(200);

    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${loginResponse.body.accessToken}`)
      .expect(200)
      .expect({
        id: 2,
        name: 'Viewer',
        email: 'viewer@example.com',
        role: Role.VIEWER,
      });
  });

  it('allows admin and rejects viewer on admin-only endpoints', async () => {
    const admin = await login('admin@example.com', 'admin-password').expect(
      200,
    );
    const viewer = await login('viewer@example.com', 'viewer-password').expect(
      200,
    );

    await request(app.getHttpServer())
      .get('/api/test-role/admin')
      .set('Authorization', `Bearer ${admin.body.accessToken}`)
      .expect(200)
      .expect({ allowed: true });

    await request(app.getHttpServer())
      .get('/api/test-role/admin')
      .set('Authorization', `Bearer ${viewer.body.accessToken}`)
      .expect(403);
  });

  afterAll(async () => {
    await app.close();
  });
});
