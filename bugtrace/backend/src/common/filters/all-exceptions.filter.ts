import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiResponse } from '../interceptors/transform.interceptor';

/**
 * 全局异常过滤器：任何异常统一转换为 { code, message, data: null }。
 *  - HttpException：code = 状态码（业务错误码从 HttpStatus 派生），message 取异常消息
 *  - 其他异常：code = 500，message = 内部服务器错误
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status: HttpStatus;
    let message: string | string[];

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (typeof body === 'object' && body !== null) {
        message = (body as { message?: string | string[] }).message ?? exception.message;
      } else {
        message = exception.message;
      }
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = '内部服务器错误';
      this.logger.error(
        `Unhandled exception: ${exception instanceof Error ? exception.stack : String(exception)}`,
      );
    }

    const body: ApiResponse<null> = {
      code: status,
      message: Array.isArray(message) ? message.join('; ') : message,
      data: null,
    };

    response.status(status).json(body);
  }
}
