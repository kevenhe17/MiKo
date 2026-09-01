import { Module } from '@nestjs/common';
import { TestCaseController } from './test-case.controller';
import { TestCaseService } from './test-case.service';

/**
 * test-case 模块（T2-1）：用例 CRUD + 关联需求（6 接口）
 * 写权限仅 QA/ADMIN；删除为物理删除
 */
@Module({
  controllers: [TestCaseController],
  providers: [TestCaseService],
})
export class TestCaseModule {}
