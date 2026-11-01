import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : null;

    let message: string | string[] = 'Internal server error';
    let error = 'Internal Server Error';

    if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
      const resp = exceptionResponse as Record<string, any>;
      message = resp.message || message;
      error = resp.error || error;
    } else if (typeof exceptionResponse === 'string') {
      message = exceptionResponse;
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    // Do not leak internal stack traces to clients in production
    if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `[${request.method}] ${request.url} - Internal error: ${
          exception instanceof Error ? exception.stack : String(exception)
        }`,
      );
      if (process.env.NODE_ENV === 'production') {
        message = 'An unexpected internal error occurred. Please contact support.';
      }
    } else {
      this.logger.warn(
        `[${request.method}] ${request.url} [${status}]: ${JSON.stringify(message)}`,
      );
    }

    response.status(status).json({
      success: false,
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
      error,
    });
  }
}
