import { Module } from '@nestjs/common';
import { BugController } from './bug.controller';
import { BugService } from './bug.service';

/**
 * bug 模块（T3-1 起分步实装）：
 *  - T3-1：状态机（bug-status.machine.ts）+ 提单/列表/详情接口
 *  - T3-2：7 个流转接口 + bug_log 留痕
 */
@Module({
  controllers: [BugController],
  providers: [BugService],
})
export class BugModule {}
