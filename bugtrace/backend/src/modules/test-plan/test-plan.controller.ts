import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TestPlanService } from './test-plan.service';
import { CreateTestPlanDto } from './dto/test-plan.dto';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

@ApiTags('test-plan')
@ApiBearerAuth()
@Controller('test-plans')
export class TestPlanController {
  constructor(private readonly testPlanService: TestPlanService) {}

  @Post()
  @ApiOperation({ summary: '创建测试计划（仅 QA/ADMIN；case_ids 必须同项目且存在）' })
  create(@Body() dto: CreateTestPlanDto, @CurrentUser() user: JwtPayload) {
    this.testPlanService.assertWritable(user.role);
    return this.testPlanService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: '计划列表（分页，含用例数统计）' })
  list(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('projectId') projectId?: string,
  ) {
    return this.testPlanService.list(
      Math.max(1, Number.parseInt(page ?? '1', 10) || 1),
      Math.min(100, Math.max(1, Number.parseInt(pageSize ?? '10', 10) || 10)),
      Number.parseInt(projectId ?? '0', 10) || 0,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: '计划详情（返回用例明细数组）' })
  detail(@Param('id') id: string) {
    return this.testPlanService.detail(id);
  }
}
