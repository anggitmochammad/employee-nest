import { Test, TestingModule } from '@nestjs/testing';
import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  INestApplication,
  Post,
  Query,
} from '@nestjs/common';
import { IsEmail, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from '../src/configure-app.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

class TestBodyDto {
  @IsEmail()
  email: string;
}

class TestQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number;
}

// Endpoint ini hanya tersedia di aplikasi pengujian.
@Controller('test-validation')
class ValidationTestController {
  @Post()
  create(@Body() body: TestBodyDto) {
    return body;
  }

  @Get()
  list(@Query() query: TestQueryDto) {
    return query;
  }

  @Get('forbidden')
  forbidden() {
    throw new ForbiddenException('Access denied');
  }
}

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;
  const databaseQuery = vi.fn().mockResolvedValue([{ value: 1 }]);

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [ValidationTestController],
    })
      .overrideProvider(PrismaService)
      .useValue({ $queryRaw: databaseQuery })
      .compile();

    app = moduleFixture.createNestApplication();
    await configureApp(app);
  });

  it('serves the API under /api', () => {
    return request(app.getHttpServer())
      .get('/api')
      .expect(200)
      .expect('Hello World!');
  });

  it('serves database health outside the API prefix', async () => {
    await request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect({ status: 'ok', database: 'up' });
    expect(databaseQuery).toHaveBeenCalled();
    await request(app.getHttpServer()).get('/api/health').expect(404);
  });

  it('serves Swagger documentation outside the API prefix', async () => {
    const page = await request(app.getHttpServer())
      .get('/api-documentation')
      .expect(200);
    expect(page.text).toContain('Employee Management API Documentation');
    expect(page.text).toContain('Send Request');

    const specification = await request(app.getHttpServer())
      .get('/api-documentation-json')
      .expect(200);
    expect(specification.body.paths).toHaveProperty('/api/auth/login');
    expect(specification.body.paths).toHaveProperty('/api/auth/me');
    expect(specification.body.paths).toHaveProperty('/health');
    expect(specification.body.components.securitySchemes).toHaveProperty(
      'access-token',
    );

    await request(app.getHttpServer())
      .get('/api/api-documentation')
      .expect(404);
  });

  it('returns 503 when the database health query fails', async () => {
    databaseQuery.mockRejectedValueOnce(new Error('Database unavailable'));
    const response = await request(app.getHttpServer())
      .get('/health')
      .expect(503);
    expect(response.body).toMatchObject({
      statusCode: 503,
      message: 'Database connection unavailable',
      errors: [],
      path: '/health',
    });
  });

  it('returns consistent not-found and forbidden errors', async () => {
    const missing = await request(app.getHttpServer())
      .get('/missing')
      .expect(404);
    expect(missing.body).toMatchObject({
      statusCode: 404,
      errors: [],
      path: '/missing',
    });
    expect(missing.body.timestamp).toEqual(expect.any(String));
    const forbidden = await request(app.getHttpServer())
      .get('/api/test-validation/forbidden')
      .expect(403);
    expect(forbidden.body).toMatchObject({
      statusCode: 403,
      message: 'Access denied',
      errors: [],
    });
  });

  it('validates request bodies and rejects unknown fields', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/test-validation')
      .send({ email: 'invalid', unexpected: true })
      .expect(400);
    expect(response.body.message).toBe('Validation failed');
    expect(response.body.errors).toEqual(
      expect.arrayContaining([
        'email must be an email',
        'property unexpected should not exist',
      ]),
    );
    await request(app.getHttpServer())
      .post('/api/test-validation')
      .send({ email: 'employee@example.com' })
      .expect(201)
      .expect({ email: 'employee@example.com' });
  });

  it('transforms and validates query parameters', async () => {
    await request(app.getHttpServer())
      .get('/api/test-validation?page=2')
      .expect(200)
      .expect({ page: 2 });
    await request(app.getHttpServer())
      .get('/api/test-validation?page=0')
      .expect(400);
  });

  it('allows CORS only for configured origins', async () => {
    const origin = (process.env.CORS_ORIGINS ?? 'http://localhost:5173')
      .split(',')[0]
      .trim();
    const allowed = await request(app.getHttpServer())
      .options('/api')
      .set('Origin', origin)
      .set('Access-Control-Request-Method', 'GET')
      .expect(204);
    expect(allowed.headers['access-control-allow-origin']).toBe(origin);
    const blocked = await request(app.getHttpServer())
      .get('/api')
      .set('Origin', 'https://unconfigured.example')
      .expect(200);
    expect(blocked.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('limits API requests to 60 per minute and keeps health available', async () => {
    for (let i = 0; i < 60; i++) {
      await request(app.getHttpServer()).get('/api').expect(200);
    }
    const response = await request(app.getHttpServer()).get('/api').expect(429);
    expect(response.body).toMatchObject({ statusCode: 429, errors: [] });
    expect(response.headers['retry-after']).toBeDefined();
    await request(app.getHttpServer()).get('/health').expect(200);
  });

  afterEach(async () => {
    await app.close();
  });
});
