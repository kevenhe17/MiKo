import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { BugService } from './bug.service';
import { CreateBugDto } from './dto/bug.dto';
import {
  AssignBugDto,
  CloseBugDto,
  CommentBugDto,
  FixBugDto,
  RejectBugDto,
  VerifyBugDto,
} from './dto/bug-transition.dto';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

@ApiTags('bug')
@ApiBearerAuth()
@Controller('bugs')
export class BugController {
  constructor(private readonly bugService: BugService) {}

  @Post()
  @ApiOperation({ summary: '提单（仅 QA/ADMIN；code 自动生成 BUG-{项目code}-{序号}）' })
  create(@Body() dto: CreateBugDto, @CurrentUser() user: JwtPayload) {
    this.bugService.assertCreatable(user.role);
    return this.bugService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Bug 列表（status/severity/ownerId 筛选 + 分页；DEV 仅见自己的）' })
  list(
    @CurrentUser() user: JwtPayload,
    @Query('status') status?: string,
    @Query('severity') severity?: string,
    @Query('ownerId') ownerId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.bugService.list(
      {
        status: status || undefined,
        severity: severity || undefined,
        ownerId: Number.parseInt(ownerId ?? '0', 10) || 0,
      },
      { id: user.sub, role: user.role },
      Math.max(1, Number.parseInt(page ?? '1', 10) || 1),
      Math.min(100, Math.max(1, Number.parseInt(pageSize ?? '10', 10) || 10)),
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Bug 详情（含 bug_log 与 attachment 列表）' })
  detail(@Param('id') id: string) {
    return this.bugService.detail(id);
  }

  // —— T3-2 · 七个流转端点：状态机校验 + bug_log 自动留痕 ——

  @Post(':id/assign')
  @ApiOperation({ summary: '分派（QA/ADMIN）：指定处理人，NEW/REOPENED → ASSIGNED' })
  assign(@Param('id') id: string, @Body() dto: AssignBugDto, @CurrentUser() user: JwtPayload) {
    return this.bugService.assign(id, dto, { id: user.sub, role: user.role });
  }

  @Post(':id/start')
  @ApiOperation({ summary: '开始处理（DEV）：自动置 fixer=自己，ASSIGNED → IN_PROGRESS' })
  start(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.bugService.start(id, { id: user.sub, role: user.role });
  }

  @Post(':id/fix')
  @ApiOperation({ summary: '填写修复（DEV）：root_cause/fix_desc/impact 必填，IN_PROGRESS → FIXED' })
  fix(@Param('id') id: string, @Body() dto: FixBugDto, @CurrentUser() user: JwtPayload) {
    return this.bugService.fix(id, dto, { id: user.sub, role: user.role });
  }

  @Post(':id/verify')
  @ApiOperation({ summary: '回归验证（QA/ADMIN）：passed=true → VERIFIED；false → 回 IN_PROGRESS 并追加重开流水' })
  verify(@Param('id') id: string, @Body() dto: VerifyBugDto, @CurrentUser() user: JwtPayload) {
    return this.bugService.verify(id, dto, { id: user.sub, role: user.role });
  }

  @Post(':id/close')
  @ApiOperation({ summary: '关闭（QA/ADMIN）：comment 可选，FIXED/REJECTED → CLOSED' })
  close(@Param('id') id: string, @Body() dto: CloseBugDto, @CurrentUser() user: JwtPayload) {
    return this.bugService.close(id, { id: user.sub, role: user.role }, dto.comment);
  }

  @Post(':id/reopen')
  @ApiOperation({ summary: '重开（QA/ADMIN）：comment 必填，CLOSED → REOPENED' })
  reopen(@Param('id') id: string, @Body() dto: CommentBugDto, @CurrentUser() user: JwtPayload) {
    return this.bugService.reopen(id, dto.comment, { id: user.sub, role: user.role });
  }

  @Post(':id/reject')
  @ApiOperation({ summary: '拒绝（ADMIN）：reason 必填，ASSIGNED → CLOSED' })
  reject(@Param('id') id: string, @Body() dto: RejectBugDto, @CurrentUser() user: JwtPayload) {
    return this.bugService.reject(id, dto.reason, { id: user.sub, role: user.role });
  }
}
