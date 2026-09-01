import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

/**
 * 统一响应拦截器：所有成功响应包装为 { code: 0, message: 'ok', data }。
 * 约定见《MVP 范围定义》6.2 工程约定：统一返回 {code, msg, data}。
 */
@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  intercept(
    _context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((data) => ({
        code: 0,
        message: 'ok',
        data,
      })),
    );
  }
}
