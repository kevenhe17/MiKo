import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UserController } from './user.controller';

/**
 * auth 模块（T1-1）：登录/登出 + JWT 签发；T1-5 增补 GET /users（下拉选择用）
 * 鉴权守卫与白名单在 T0-5 已全局接线（app.module.ts）
 */
@Module({
  controllers: [AuthController, UserController],
  providers: [AuthService],
})
export class AuthModule {}
