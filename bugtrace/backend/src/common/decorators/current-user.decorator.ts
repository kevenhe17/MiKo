import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

/**
 * T1-1 · @CurrentUser() 参数装饰器
 * 从 JwtAuthGuard 挂到 request 上的 payload 注入当前用户（sub + role）。
 */
export interface JwtPayload {
  sub: string;
  role: 'ADMIN' | 'DEV' | 'QA';
  username: string;
  realname: string;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtPayload => {
    const request = ctx.switchToHttp().getRequest<Request & { user?: JwtPayload }>();
    return request.user as JwtPayload;
  },
);
