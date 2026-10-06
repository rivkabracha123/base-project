import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import type { Request, Response } from 'express';

function isMulterError(exception: unknown): exception is { message: string; name: 'MulterError' } {
  if (typeof exception !== 'object' || exception === null) return false;
  const candidate = exception as { message?: unknown; name?: unknown };
  return candidate.name === 'MulterError' && typeof candidate.message === 'string';
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const request = host.switchToHttp().getRequest<Request>();
    const multerError = isMulterError(exception);
    const status = exception instanceof HttpException
      ? exception.getStatus()
      : multerError
        ? HttpStatus.BAD_REQUEST
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const detail = exception instanceof HttpException ? exception.getResponse() : undefined;
    const message = typeof detail === 'string'
      ? detail
      : detail
        ? (detail as { message?: string | string[] }).message ?? 'Request failed'
        : multerError
          ? exception.message
          : 'Internal server error';

    response.status(status).json({
      statusCode: status,
      error: HttpStatus[status] ?? 'Error',
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
