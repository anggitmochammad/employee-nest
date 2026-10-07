import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

// Membentuk respons error yang konsisten, termasuk URL request dan waktu kejadian.
export function errorResponse(
  statusCode: number,
  message: string,
  errors: string[],
  path: string,
) {
  return {
    statusCode,
    message,
    errors,
    path,
    timestamp: new Date().toISOString(),
  };
}

// @Catch() tanpa tipe exception akan menangkap semua exception yang masuk ke exception filter.
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    // Mengambil objek request dan response dari konteks HTTP.
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();

    // Gunakan status dari HttpException, error lain dianggap sebagai error internal (500).
    const statusCode =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    // Pesan umum ini mencegah detail error internal bocor ke pemanggil API.
    let message = 'Internal server error';
    let errors: string[] = [];

    if (exception instanceof HttpException) {
      // Respons HttpException dapat berupa teks atau objek berisi pesan dan detail error.
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else {
        const details = body as {
          message?: string | string[];
          errors?: string[];
        };
        if (Array.isArray(details.message)) {
          // ValidationPipe mengembalikan daftar pesan; simpan daftar tersebut dalam errors.
          message = 'Validation failed';
          errors = details.message;
        } else {
          message = details.message ?? exception.message;
          errors = details.errors ?? [];
        }
      }
    }

    // Catat error server di log agar penyebabnya dapat diperiksa saat debugging.
    if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(exception);
    }

    // Kirim status HTTP dan respons JSON dengan format yang sama untuk setiap error.
    response
      .status(statusCode)
      .json(errorResponse(statusCode, message, errors, request.path));
  }
}
