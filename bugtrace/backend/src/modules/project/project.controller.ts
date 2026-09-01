import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ProjectService } from './project.service';
import { CreateProjectDto, InviteMemberDto, UpdateProjectDto } from './dto/project.dto';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

@ApiTags('project')
@ApiBearerAuth()
@Controller('projects')
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  @Post()
  @ApiOperation({ summary: '创建项目（仅 ADMIN）' })
  create(@Body() dto: CreateProjectDto, @CurrentUser() user: JwtPayload) {
    this.projectService.assertWritable(user.role);
    return this.projectService.create(dto, user.sub);
  }

  @Get()
  @ApiOperation({ summary: '项目列表（分页）' })
  list(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.projectService.list(
      Math.max(1, Number.parseInt(page ?? '1', 10) || 1),
      Math.min(100, Math.max(1, Number.parseInt(pageSize ?? '10', 10) || 10)),
    );
  }

  @Get(':id')
  @ApiOperation({ summary: '项目详情（含 members）' })
  detail(@Param('id') id: string) {
    return this.projectService.detail(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: '编辑项目（仅 ADMIN）' })
  update(@Param('id') id: string, @Body() dto: UpdateProjectDto, @CurrentUser() user: JwtPayload) {
    this.projectService.assertWritable(user.role);
    return this.projectService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除项目（仅 ADMIN；项目下存在需求/用例/计划/Bug/变更单时拒绝）' })
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    this.projectService.assertWritable(user.role);
    return this.projectService.remove(id);
  }

  @Post(':id/members')
  @ApiOperation({ summary: '邀请成员（仅 ADMIN）' })
  invite(
    @Param('id') id: string,
    @Body() dto: InviteMemberDto,
    @CurrentUser() user: JwtPayload,
  ) {
    this.projectService.assertWritable(user.role);
    return this.projectService.invite(id, dto);
  }
}
