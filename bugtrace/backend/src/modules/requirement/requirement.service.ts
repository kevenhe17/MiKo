import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateRequirementDto, UpdateRequirementDto } from './dto/requirement.dto';
import { can } from '../../common/constants/permission.const';

@Injectable()
export class RequirementService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateRequirementDto) {
    const project = await this.prisma.project.findUnique({ where: { id: BigInt(dto.projectId) } });
    if (!project) {
      throw new BadRequestException('所属项目不存在');
    }

    // code 生成：REQ-{项目code}-{4位序号}（同项目内递增，取当前最大序号 +1）
    const count = await this.prisma.requirement.count({ where: { projectId: project.id } });
    const seq = String(count + 1).padStart(4, '0');
    const code = `REQ-${project.code}-${seq}`;

    // 防极小概率撞 code（历史数据被清过时 count 会回退）
    const exists = await this.prisma.requirement.findUnique({ where: { code } });
    if (exists) {
      throw new BadRequestException('需求编号生成冲突，请重试');
    }

    return this.prisma.requirement.create({
      data: {
        projectId: project.id,
        code,
        title: dto.title,
        description: dto.description,
        status: 'OPEN',
      },
    });
  }

  async list(projectId: number, page = 1, pageSize = 10) {
    const where = projectId ? { projectId: BigInt(projectId) } : {};
    const skip = (page - 1) * pageSize;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.requirement.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: pageSize }),
      this.prisma.requirement.count({ where }),
    ]);
    return { list: items, total, page, pageSize };
  }

  async detail(id: string) {
    const requirement = await this.prisma.requirement.findUnique({
      where: { id: BigInt(id) },
      include: { project: { select: { id: true, code: true, name: true } } },
    });
    if (!requirement) {
      throw new NotFoundException('需求不存在');
    }
    return requirement;
  }

  async update(id: string, dto: UpdateRequirementDto) {
    const exists = await this.prisma.requirement.findUnique({ where: { id: BigInt(id) } });
    if (!exists) {
      throw new NotFoundException('需求不存在');
    }
    return this.prisma.requirement.update({
      where: { id: exists.id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
    });
  }

  /** 删除需求（仅 ADMIN）：安全校验——被用例 / Bug / 变更单引用时拒绝删除 */
  async remove(id: string) {
    const exists = await this.prisma.requirement.findUnique({ where: { id: BigInt(id) } });
    if (!exists) {
      throw new NotFoundException('需求不存在');
    }
    const [caseCount, bugCount, changeCount] = await this.prisma.$transaction([
      this.prisma.testCase.count({ where: { requirementId: exists.id } }),
      this.prisma.bug.count({ where: { requirementId: exists.id } }),
      this.prisma.changeRequest.count({ where: { sourceType: 'REQUIREMENT', sourceId: exists.id } }),
    ]);
    const total = caseCount + bugCount + changeCount;
    if (total > 0) {
      throw new BadRequestException(
        `需求被引用中（用例 ${caseCount} / 缺陷 ${bugCount} / 变更单 ${changeCount}），请先解除引用后再删除`,
      );
    }
    await this.prisma.requirement.delete({ where: { id: exists.id } });
    return { deleted: true };
  }

  // —— 权限断言：REQUIREMENT_WRITE 仅 ADMIN ——
  assertWritable(role: string): void {
    if (!can('REQUIREMENT_WRITE', role as never)) {
      throw new ForbiddenException('仅管理员可登记/编辑需求');
    }
  }
}
