import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { ProjectModule } from './modules/project/project.module';
import { RequirementModule } from './modules/requirement/requirement.module';
import { TestCaseModule } from './modules/test-case/test-case.module';
import { TestPlanModule } from './modules/test-plan/test-plan.module';
import { BugModule } from './modules/bug/bug.module';
import { AttachmentModule } from './modules/attachment/attachment.module';
import { ChangeModule } from './modules/change/change.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';

@Module({
  imports: [
    PrismaModule,
    // JWT 基础接线（T0-5）：密钥从 .env 的 JWT_SECRET 读取，HS256
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET ?? 'bugtrace-dev-secret',
      signOptions: { expiresIn: '8h', algorithm: 'HS256' },
    }),
    HealthModule,
    // —— P1-P3 空壳模块（业务代码由后续任务填充）——
    AuthModule,
    ProjectModule,
    RequirementModule,
    TestCaseModule,
    TestPlanModule,
    BugModule,
    AttachmentModule,
    ChangeModule,
  ],
  providers: [
    // 全局守卫：白名单外的所有路由必须携带有效 JWT（T0-5）
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
