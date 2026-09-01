import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { AUTH_WHITELIST } from '../constants/auth-whitelist';

/**
 * T0-5 · 全局 JWT 守卫
 *  - 只验证 token 的存在性、签名与有效期（HS256，签发时 8h）
 *  - 不做用户信息解析/查库（@CurrentUser 注入由 T1-1 实现）
 *  - 白名单见 auth-whitelist.ts
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    if (this.isWhitelisted(request.path)) {
      return true;
    }

    const token = this.extractToken(request);
    if (!token) {
      throw new UnauthorizedException('未登录或缺少 token');
    }

    try {
      // 仅验证签名与有效期；payload 不在本任务使用
      const payload = this.jwtService.verify(token);
      // 挂到 request 上，供 T1-1 的 @CurrentUser 装饰器读取
      (request as Request & { user?: unknown }).user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('token 无效或已过期');
    }
  }

  private isWhitelisted(path: string): boolean {
    return AUTH_WHITELIST.some((p) => {
      if (p.endsWith('*')) {
        return path.startsWith(p.slice(0, -1));
      }
      return path === p || path.startsWith(`${p}/`) || path.startsWith(`${p}?`);
    });
  }

  private extractToken(request: Request): string | null {
    const [type, token] = (request.headers.authorization ?? '').split(' ');
    return type === 'Bearer' && token ? token : null;
  }
}
