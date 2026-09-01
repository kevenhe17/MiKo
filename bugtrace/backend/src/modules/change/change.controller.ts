import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ChangeService } from './change.service';
import {
  CreateChangeRequestDto,
  CrCommentDto,
  CrMergeDto,
  CrOptionalCommentDto,
  CrReleaseDto,
} from './dto/change.dto';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

@ApiTags('change')
@ApiBearerAuth()
@Controller('changes')
export class ChangeController {
  constructor(private readonly changeService: ChangeService) {}

  @Post()
  @ApiOperation({ summary: '创建变更单（DEV/ADMIN；DRAFT 态，code 自动生成 CR-{项目code}-{序号}）' })
  create(@Body() dto: CreateChangeRequestDto, @CurrentUser() user: JwtPayload) {
    return this.changeService.create(dto, { id: user.sub, role: user.role });
  }

  @Get()
  @ApiOperation({ summary: 'CR 列表（projectId 必筛；status/type/sourceType/sourceId/ownerId + 分页）' })
  list(
    @Query('projectId') projectId: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('sourceType') sourceType?: string,
    @Query('sourceId') sourceId?: string,
    @Query('ownerId') ownerId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.changeService.list(
      {
        projectId: Number.parseInt(projectId ?? '0', 10),
        status: status || undefined,
        type: type || undefined,
        sourceType: sourceType || undefined,
        sourceId: Number.parseInt(sourceId ?? '0', 10) || 0,
        ownerId: Number.parseInt(ownerId ?? '0', 10) || 0,
      },
      Math.max(1, Number.parseInt(page ?? '1', 10) || 1),
      Math.min(100, Math.max(1, Number.parseInt(pageSize ?? '10', 10) || 10)),
    );
  }

  // —— T5-3 · 统计端点（报表与可视化数据源；置于 :id 之前避免路径冲突） ——

  @Get('stats/overview')
  @ApiOperation({ summary: '变更总览指标：总数/状态分布/类型分布/风险分布/平均流转时长/待回流数' })
  statsOverview(@Query('projectId') projectId: string) {
    return this.changeService.statsOverview(Number.parseInt(projectId ?? '0', 10));
  }

  @Get('stats/trend')
  @ApiOperation({ summary: '流转趋势：近 N 天（默认14，上限90）每日新建数与流转事件数' })
  statsTrend(@Query('projectId') projectId: string, @Query('days') days?: string) {
    return this.changeService.statsTrend(
      Number.parseInt(projectId ?? '0', 10),
      Number.parseInt(days ?? '14', 10) || 14,
    );
  }

  @Get('stats/backflow')
  @ApiOperation({ summary: '待回流清单：HOTFIX/release 类未回流 CR（含负责人，供催办）' })
  statsBackflow(@Query('projectId') projectId: string) {
    return this.changeService.statsBackflow(Number.parseInt(projectId ?? '0', 10));
  }

  @Get(':id')
  @ApiOperation({ summary: 'CR 详情（含 change_log 流水时间轴）' })
  detail(@Param('id') id: string) {
    return this.changeService.detail(id);
  }

  // —— 10 条流转端点：状态机校验 + change_log 自动留痕 ——

  @Post(':id/submit')
  @ApiOperation({ summary: '提交评审（DEV/ADMIN）：DRAFT → IN_REVIEW，自动带出评审人' })
  submit(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.changeService.submit(id, { id: user.sub, role: user.role });
  }

  @Post(':id/approve')
  @ApiOperation({ summary: '评审通过（DEV/ADMIN，评审人≠负责人）：IN_REVIEW → APPROVED' })
  approve(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CrOptionalCommentDto,
  ) {
    return this.changeService.approve(id, { id: user.sub, role: user.role }, dto?.comment);
  }

  @Post(':id/reject-review')
  @ApiOperation({ summary: '评审驳回（DEV/ADMIN）：IN_REVIEW → DRAFT，理由必填' })
  rejectReview(@Param('id') id: string, @Body() dto: CrCommentDto, @CurrentUser() user: JwtPayload) {
    return this.changeService.rejectReview(id, dto.comment, { id: user.sub, role: user.role });
  }

  @Post(':id/start-build')
  @ApiOperation({ summary: '触发构建（ADMIN，模拟 CI）：APPROVED → BUILDING' })
  startBuild(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.changeService.startBuild(id, { id: user.sub, role: user.role });
  }

  @Post(':id/build-done')
  @ApiOperation({ summary: '构建完成（ADMIN，模拟 CI 回写）：BUILDING → REGRESSION' })
  buildDone(@Param('id') id: string, @CurrentUser() user: JwtPayload, @Body() dto?: CrOptionalCommentDto) {
    return this.changeService.buildDone(id, { id: user.sub, role: user.role }, dto?.comment);
  }

  @Post(':id/regression-done')
  @ApiOperation({ summary: '回归完成（QA/ADMIN）：REGRESSION → GATE_CHECK' })
  regressionDone(@Param('id') id: string, @CurrentUser() user: JwtPayload, @Body() dto?: CrOptionalCommentDto) {
    return this.changeService.regressionDone(id, { id: user.sub, role: user.role }, dto?.comment);
  }

  @Post(':id/gate-pass')
  @ApiOperation({ summary: '门禁通过（ADMIN）：GATE_CHECK → AWAITING_MERGE' })
  gatePass(@Param('id') id: string, @CurrentUser() user: JwtPayload, @Body() dto?: CrOptionalCommentDto) {
    return this.changeService.gatePass(id, { id: user.sub, role: user.role }, dto?.comment);
  }

  @Post(':id/merge')
  @ApiOperation({ summary: '合入（ADMIN）：AWAITING_MERGE → MERGED，回写合入人/时间/sha' })
  merge(@Param('id') id: string, @Body() dto: CrMergeDto, @CurrentUser() user: JwtPayload) {
    return this.changeService.merge(id, dto, { id: user.sub, role: user.role });
  }

  @Post(':id/release')
  @ApiOperation({ summary: '发布（ADMIN）：MERGED → RELEASED，回填 Tag' })
  release(@Param('id') id: string, @Body() dto: CrReleaseDto, @CurrentUser() user: JwtPayload) {
    return this.changeService.release(id, dto, { id: user.sub, role: user.role });
  }

  @Post(':id/abandon')
  @ApiOperation({ summary: '废弃（创建人/ADMIN）：任意非终态 → ABANDONED，原因必填' })
  abandon(@Param('id') id: string, @Body() dto: CrCommentDto, @CurrentUser() user: JwtPayload) {
    return this.changeService.abandon(id, dto.comment, { id: user.sub, role: user.role });
  }

  @Post(':id/backflow-done')
  @ApiOperation({ summary: '回流完成（QA/ADMIN）：HOTFIX/release 类 CR 标记已回流（不改状态）' })
  backflowDone(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.changeService.backflowDone(id, { id: user.sub, role: user.role });
  }
}
