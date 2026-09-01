import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TestCaseService } from './test-case.service';
import { CreateTestCaseDto, LinkRequirementDto, UpdateTestCaseDto } from './dto/test-case.dto';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

@ApiTags('test-case')
@ApiBearerAuth()
@Controller('test-cases')
export class TestCaseController {
  constructor(private readonly testCaseService: TestCaseService) {}

  @Post()
  @ApiOperation({ summary: '创建用例（仅 QA/ADMIN）' })
  create(@Body() dto: CreateTestCaseDto, @CurrentUser() user: JwtPayload) {
    this.testCaseService.assertWritable(user.role);
    return this.testCaseService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: '用例列表（project_id + module + priority 筛选 + 分页）' })
  list(
    @Query('projectId') projectId?: string,
    @Query('module') module?: string,
    @Query('priority') priority?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.testCaseService.list(
      {
        projectId: Number.parseInt(projectId ?? '0', 10) || 0,
        module: module || undefined,
        priority: priority || undefined,
      },
      Math.max(1, Number.parseInt(page ?? '1', 10) || 1),
      Math.min(100, Math.max(1, Number.parseInt(pageSize ?? '10', 10) || 10)),
    );
  }

  @Get(':id')
  @ApiOperation({ summary: '用例详情（含 requirement 摘要）' })
  detail(@Param('id') id: string) {
    return this.testCaseService.detail(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: '编辑用例（仅 QA/ADMIN）' })
  update(@Param('id') id: string, @Body() dto: UpdateTestCaseDto, @CurrentUser() user: JwtPayload) {
    this.testCaseService.assertWritable(user.role);
    return this.testCaseService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除用例（物理删除，仅 QA/ADMIN）' })
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    this.testCaseService.assertWritable(user.role);
    return this.testCaseService.remove(id);
  }

  @Post(':id/requirement')
  @ApiOperation({ summary: '关联需求（requirementId 传 null 清除；仅 QA/ADMIN）' })
  linkRequirement(
    @Param('id') id: string,
    @Body() dto: LinkRequirementDto,
    @CurrentUser() user: JwtPayload,
  ) {
    this.testCaseService.assertWritable(user.role);
    return this.testCaseService.linkRequirement(id, dto);
  }
}
