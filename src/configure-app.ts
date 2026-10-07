import { RequestMethod, ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  errorResponse,
  AllExceptionsFilter,
} from './common/filters/all-exceptions.filter.js';
import type { Request, Response } from 'express';

// Digunakan oleh aplikasi dan pengujian E2E agar keduanya memakai konfigurasi yang sama.
export async function configureApp(app: INestApplication): Promise<void> {
  const config = app.get(ConfigService);
  const origins = config
    .get<string>('CORS_ORIGINS', 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  // set global prefix api kecuali /health
  app.setGlobalPrefix('api', {
    exclude: [{ path: 'health', method: RequestMethod.GET }],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      validationError: { target: false, value: false },
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableCors({
    origin: origins,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
  app.enableShutdownHooks();
  await app.init();

  // Penanganan 404 Nest terbatas pada /api; samakan format error untuk URL di luar prefix.
  app.use((request: Request, response: Response) => {
    response
      .status(404)
      .json(
        errorResponse(
          404,
          `Cannot ${request.method} ${request.path}`,
          [],
          request.path,
        ),
      );
  });
}
