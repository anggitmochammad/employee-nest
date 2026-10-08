import { RequestMethod, ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  errorResponse,
  AllExceptionsFilter,
} from './common/filters/all-exceptions.filter.js';
import type { Request, Response } from 'express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

// Digunakan oleh aplikasi dan pengujian E2E agar keduanya memakai konfigurasi yang sama.
export async function configureApp(app: INestApplication): Promise<void> {
  const config = app.get(ConfigService);
  const origins = config
    .get<string>('CORS_ORIGINS', 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const nodeEnv = config.get<string>('NODE_ENV', 'development');

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

  if (nodeEnv !== 'production') {
    // Swagger UI sengaja berada di luar prefix /api agar URL dokumentasi tetap ringkas.
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Employee Management API')
      .setDescription('Dokumentasi endpoint Employee Management System')
      .setVersion('1.0')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        'access-token',
      )
      .build();
    const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api-documentation', app, swaggerDocument, {
      useGlobalPrefix: false,
      customSiteTitle: 'Employee Management API Documentation',
      swaggerOptions: {
        persistAuthorization: true,
        tryItOutEnabled: true,
        displayRequestDuration: true,
        filter: true,
      },
      // Swagger menamai tombol pengiriman "Execute"; sesuaikan dengan istilah mini Postman.
      customJsStr: `
      (() => {
        const root = document.getElementById('swagger-ui');
        if (!root) return;

        const renameExecuteButtons = () => {
          root.querySelectorAll('button.execute').forEach((button) => {
            // Ubah hanya label bawaan agar observer tidak memicu dirinya terus-menerus.
            // Label lain seperti status loading tetap dikelola Swagger.
            if (button.textContent.trim() === 'Execute') {
              button.textContent = 'Send Request';
            }
          });
        };
        new MutationObserver(renameExecuteButtons).observe(root, {
          childList: true,
          subtree: true,
        });
        renameExecuteButtons();
      })();
      `,
    });
  }

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
