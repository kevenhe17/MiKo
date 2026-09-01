import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProjectDto, InviteMemberDto, UpdateProjectDto } from './dto/project.dto';
import { can } from '../../common/constants/permission.const';

export interface ProjectMember {
  userId: string;
  role: string;
  username?: string;
  realname?: string;
}

@Injectable()
export class ProjectService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateProjectDto, operatorId: string) {
    const exists = await this.prisma.project.findUnique({ where: { code: dto.code } });
    if (exists) {
      throw new ConflictException(`项目 code「${dto.code}」已存在`);
    }

    // 创建者自动成为项目 ADMIN 成员
    const members: ProjectMember[] = [{ userId: operatorId, role: 'ADMIN' }];

    return this.prisma.project.create({
      data: {
        code: dto.code,
        name: dto.name,
        description: dto.description,
        createdBy: BigInt(operatorId),
        members: members as unknown as Prisma.InputJsonValue,
      },
    });
  }

  async list(page = 1, pageSize = 10) {
    const skip = (page - 1) * pageSize;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.project.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.project.count(),
    ]);
    return { list: items, total, page, pageSize };
  }

  async detail(id: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: BigInt(id) },
      include: { creator: { select: { id: true, username: true, realname: true } } },
    });
    if (!project) {
      throw new NotFoundException('项目不存在');
    }
    // members JSON 列补充用户名，便于前端展示
    const members = await this.enrichMembers(project.members as unknown as ProjectMember[]);
    return { ...project, members };
  }

  async update(id: string, dto: UpdateProjectDto) {
    await this.ensureExists(id);
    return this.prisma.project.update({
      where: { id: BigInt(id) },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
      },
    });
  }

  /** 删除项目（仅 ADMIN）：安全校验——项目下存在任何需求/用例/计划/Bug/变更单时拒绝删除 */
  async remove(id: string) {
    const project = await this.ensureExists(id);
    const pid = project.id;
    const [requirementCount, caseCount, planCount, bugCount, changeCount] =
      await this.prisma.$transaction([
        this.prisma.requirement.count({ where: { projectId: pid } }),
        this.prisma.testCase.count({ where: { projectId: pid } }),
        this.prisma.testPlan.count({ where: { projectId: pid } }),
        this.prisma.bug.count({ where: { projectId: pid } }),
        this.prisma.changeRequest.count({ where: { projectId: pid } }),
      ]);
    const total =
      requirementCount + caseCount + planCount + bugCount + changeCount;
    if (total > 0) {
      throw new BadRequestException(
        `项目下存在关联数据（需求 ${requirementCount} / 用例 ${caseCount} / 计划 ${planCount} / 缺陷 ${bugCount} / 变更 ${changeCount}），请先清空后再删除`,
      );
    }
    await this.prisma.project.delete({ where: { id: pid } });
    return { deleted: true };
  }

  async invite(id: string, dto: InviteMemberDto) {
    const project = await this.ensureExists(id);

    const user = await this.prisma.user.findUnique({ where: { id: BigInt(dto.userId) } });
    if (!user) {
      throw new BadRequestException('被邀请用户不存在');
    }

    const members = project.members as unknown as ProjectMember[];
    if (members.some((m) => m.userId === String(dto.userId))) {
      throw new BadRequestException('该用户已是项目成员');
    }

    const next: ProjectMember[] = [
      ...members,
      { userId: String(dto.userId), role: dto.role },
    ];

    return this.prisma.project.update({
      where: { id: project.id },
      data: { members: next as unknown as Prisma.InputJsonValue },
    });
  }

  // —— 权限断言：PROJECT_WRITE 仅 ADMIN ——
  assertWritable(role: string): void {
    if (!can('PROJECT_WRITE', role as never)) {
      throw new ForbiddenException('仅管理员可执行该操作');
    }
  }

  private async ensureExists(id: string) {
    const project = await this.prisma.project.findUnique({ where: { id: BigInt(id) } });
    if (!project) {
      throw new NotFoundException('项目不存在');
    }
    return project;
  }

  private async enrichMembers(members: ProjectMember[]): Promise<ProjectMember[]> {
    const ids = [...new Set(members.map((m) => m.userId))];
    const users = await this.prisma.user.findMany({
      where: { id: { in: ids.map((i) => BigInt(i)) } },
      select: { id: true, username: true, realname: true },
    });
    const byId = new Map(users.map((u) => [u.id.toString(), u]));
    return members.map((m) => ({
      ...m,
      username: byId.get(m.userId)?.username,
      realname: byId.get(m.userId)?.realname,
    }));
  }
}
