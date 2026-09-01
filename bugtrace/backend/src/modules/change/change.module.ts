import { Module } from '@nestjs/common';
import { ChangeController } from './change.controller';
import { ChangeService } from './change.service';

/**
 * change 模块（T5-2）：主干/分支软件变更流转
 *  - CR 创建/列表/详情（关联项目与 Bug/需求来源对象）
 *  - 10 条状态机流转端点（含角色校验与 change_log 留痕）
 *  - 回流标记（HOTFIX/release 类强制双向回流）
 */
@Module({
  controllers: [ChangeController],
  providers: [ChangeService],
})
export class ChangeModule {}
