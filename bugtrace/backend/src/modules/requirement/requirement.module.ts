import { Module } from '@nestjs/common';
import { RequirementController } from './requirement.controller';
import { RequirementService } from './requirement.service';

/**
 * requirement 模块（T1-3）：需求登记 CRUD（4 接口）
 * code 自动生成 REQ-{项目code}-{4位序号}；MVP 不做删除（status OPEN/CLOSED）
 */
@Module({
  controllers: [RequirementController],
  providers: [RequirementService],
})
export class RequirementModule {}
