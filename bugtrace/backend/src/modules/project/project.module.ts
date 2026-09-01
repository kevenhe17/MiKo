import { Module } from '@nestjs/common';
import { ProjectController } from './project.controller';
import { ProjectService } from './project.service';

/**
 * project 模块（T1-2）：CRUD + 成员邀请（5 接口）
 * 权限：创建/编辑/邀请仅 ADMIN（permission.const.ts）
 */
@Module({
  controllers: [ProjectController],
  providers: [ProjectService],
})
export class ProjectModule {}
