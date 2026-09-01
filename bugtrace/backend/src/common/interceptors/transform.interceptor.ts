import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  StreamableFile,
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
  implements NestInterceptor<T, ApiResponse<T> | StreamableFile>
{
  intercept(
    _context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiResponse<T> | StreamableFile> {
    return next.handle().pipe(
      map((data) => {
        // T3-3 · 流式响应（附件下载）直接透传，不包装 JSON
        if (data instanceof StreamableFile) {
          return data;
        }
        return {
          code: 0,
          message: 'ok',
          data,
        };
      }),
    );
  }
}
