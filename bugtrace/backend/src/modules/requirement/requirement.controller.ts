import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirementService } from './requirement.service';
import { CreateRequirementDto, UpdateRequirementDto } from './dto/requirement.dto';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

@ApiTags('requirement')
@ApiBearerAuth()
@Controller('requirements')
export class RequirementController {
  constructor(private readonly requirementService: RequirementService) {}

  @Post()
  @ApiOperation({ summary: '登记需求（仅 ADMIN，code 自动生成）' })
  create(@Body() dto: CreateRequirementDto, @CurrentUser() user: JwtPayload) {
    this.requirementService.assertWritable(user.role);
    return this.requirementService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: '需求列表（按 project_id 过滤 + 分页）' })
  list(
    @Query('projectId') projectId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.requirementService.list(
      Number.parseInt(projectId ?? '0', 10) || 0,
      Math.max(1, Number.parseInt(page ?? '1', 10) || 1),
      Math.min(100, Math.max(1, Number.parseInt(pageSize ?? '10', 10) || 10)),
    );
  }

  @Get(':id')
  @ApiOperation({ summary: '需求详情' })
  detail(@Param('id') id: string) {
    return this.requirementService.detail(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: '编辑需求（仅 ADMIN）' })
  update(@Param('id') id: string, @Body() dto: UpdateRequirementDto, @CurrentUser() user: JwtPayload) {
    this.requirementService.assertWritable(user.role);
    return this.requirementService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除需求（仅 ADMIN；被用例/Bug/变更单引用时拒绝）' })
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    this.requirementService.assertWritable(user.role);
    return this.requirementService.remove(id);
  }
}
