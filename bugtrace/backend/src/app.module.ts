import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { ProjectModule } from './modules/project/project.module';
import { RequirementModule } from './modules/requirement/requirement.module';
import { TestCaseModule } from './modules/test-case/test-case.module';
import { TestPlanModule } from './modules/test-plan/test-plan.module';
import { BugModule } from './modules/bug/bug.module';
import { AttachmentModule } from './modules/attachment/attachment.module';

@Module({
  imports: [
    PrismaModule,
    HealthModule,
    // —— P1-P3 空壳模块（业务代码由后续任务填充）——
    AuthModule,
    ProjectModule,
    RequirementModule,
    TestCaseModule,
    TestPlanModule,
    BugModule,
    AttachmentModule,
  ],
})
export class AppModule {}
