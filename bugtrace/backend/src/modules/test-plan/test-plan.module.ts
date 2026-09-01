import { Module } from '@nestjs/common';
import { TestPlanController } from './test-plan.controller';
import { TestPlanService } from './test-plan.service';

/**
 * test-plan 模块（T2-2）：创建 + 关联用例（3 接口）
 * case_ids JSON 列存；status 固定 READY（待执行）
 */
@Module({
  controllers: [TestPlanController],
  providers: [TestPlanService],
})
export class TestPlanModule {}
