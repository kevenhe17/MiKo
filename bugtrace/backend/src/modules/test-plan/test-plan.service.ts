import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTestPlanDto } from './dto/test-plan.dto';
import { can } from '../../common/constants/permission.const';

const PLAN_LIST_SELECT = {
  id: true,
  projectId: true,
  name: true,
  ownerId: true,
  caseIds: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  owner: { select: { id: true, username: true, realname: true } },
} satisfies Prisma.TestPlanSelect;

@Injectable()
export class TestPlanService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateTestPlanDto) {
    const project = await this.prisma.project.findUnique({ where: { id: BigInt(dto.projectId) } });
    if (!project) {
      throw new BadRequestException('所属项目不存在');
    }

    const owner = await this.prisma.user.findUnique({ where: { id: BigInt(dto.ownerId) } });
    if (!owner) {
      throw new BadRequestException('负责人不存在');
    }

    // 校验 case_ids：每个 id 真实存在且属于同一 project
    const cases = await this.prisma.testCase.findMany({
      where: { id: { in: dto.caseIds.map((id) => BigInt(id)) } },
      select: { id: true, projectId: true },
    });
    if (cases.length !== dto.caseIds.length) {
      throw new BadRequestException('勾选的用例中有不存在的 id');
    }
    if (cases.some((c) => c.projectId !== project.id)) {
      throw new BadRequestException('不能勾选其他项目的用例');
    }

    return this.prisma.testPlan.create({
      data: {
        projectId: project.id,
        name: dto.name,
        ownerId: owner.id,
        caseIds: dto.caseIds as unknown as Prisma.InputJsonValue,
        status: 'READY', // MVP 计划状态仅「待执行」一步到位
      },
      include: { owner: { select: { id: true, username: true, realname: true } } },
    });
  }

  async list(page = 1, pageSize = 10, projectId = 0) {
    const where = projectId ? { projectId: BigInt(projectId) } : {};
    const skip = (page - 1) * pageSize;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.testPlan.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: pageSize, select: PLAN_LIST_SELECT }),
      this.prisma.testPlan.count({ where }),
    ]);
    // 每条计划附带用例数统计
    const list = items.map((plan) => ({ ...plan, caseCount: (plan.caseIds as unknown as number[]).length }));
    return { list, total, page, pageSize };
  }

  async detail(id: string) {
    const plan = await this.prisma.testPlan.findUnique({
      where: { id: BigInt(id) },
      select: {
        ...PLAN_LIST_SELECT,
        project: { select: { id: true, code: true, name: true } },
      },
    });
    if (!plan) {
      throw new NotFoundException('测试计划不存在');
    }
    // 返回 case 明细数组
    const caseIds = plan.caseIds as unknown as number[];
    const cases = caseIds.length
      ? await this.prisma.testCase.findMany({
          where: { id: { in: caseIds.map((c) => BigInt(c)) } },
          select: { id: true, module: true, title: true, priority: true, expected: true, requirement: { select: { id: true, code: true, title: true } } },
        })
      : [];
    return { ...plan, caseCount: cases.length, cases };
  }

  // —— 权限断言：TEST_PLAN_WRITE 仅 QA/ADMIN ——
  assertWritable(role: string): void {
    if (!can('TEST_PLAN_WRITE', role as never)) {
      throw new ForbiddenException('仅 QA / 管理员可创建测试计划');
    }
  }
}
