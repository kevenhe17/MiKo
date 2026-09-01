import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTestCaseDto, LinkRequirementDto, UpdateTestCaseDto } from './dto/test-case.dto';
import { can } from '../../common/constants/permission.const';

const CASE_INCLUDE = {
  requirement: { select: { id: true, code: true, title: true } },
} satisfies Prisma.TestCaseInclude;

@Injectable()
export class TestCaseService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateTestCaseDto) {
    const project = await this.prisma.project.findUnique({ where: { id: BigInt(dto.projectId) } });
    if (!project) {
      throw new BadRequestException('所属项目不存在');
    }
    return this.prisma.testCase.create({
      data: {
        projectId: project.id,
        module: dto.module,
        title: dto.title,
        precond: dto.precond,
        steps: dto.steps,
        expected: dto.expected,
        priority: dto.priority ?? 'P1',
      },
      include: CASE_INCLUDE,
    });
  }

  async list(filters: { projectId: number; module?: string; priority?: string }, page = 1, pageSize = 10) {
    const where: Prisma.TestCaseWhereInput = {};
    if (filters.projectId) {
      where.projectId = BigInt(filters.projectId);
    }
    if (filters.module) {
      where.module = { contains: filters.module };
    }
    if (filters.priority) {
      where.priority = filters.priority;
    }

    const skip = (page - 1) * pageSize;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.testCase.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: pageSize, include: CASE_INCLUDE }),
      this.prisma.testCase.count({ where }),
    ]);
    return { list: items, total, page, pageSize };
  }

  async detail(id: string) {
    const testCase = await this.prisma.testCase.findUnique({
      where: { id: BigInt(id) },
      include: { ...CASE_INCLUDE, project: { select: { id: true, code: true, name: true } } },
    });
    if (!testCase) {
      throw new NotFoundException('用例不存在');
    }
    return testCase;
  }

  async update(id: string, dto: UpdateTestCaseDto) {
    await this.ensureExists(id);
    return this.prisma.testCase.update({
      where: { id: BigInt(id) },
      data: {
        ...(dto.module !== undefined ? { module: dto.module } : {}),
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.precond !== undefined ? { precond: dto.precond } : {}),
        ...(dto.steps !== undefined ? { steps: dto.steps } : {}),
        ...(dto.expected !== undefined ? { expected: dto.expected } : {}),
        ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
      },
      include: CASE_INCLUDE,
    });
  }

  async remove(id: string) {
    await this.ensureExists(id);
    // MVP 物理删除；被 Bug 引用的用例删除会因外键失败，给出可读错误
    try {
      await this.prisma.testCase.delete({ where: { id: BigInt(id) } });
    } catch {
      throw new BadRequestException('该用例已被 Bug 引用，无法删除');
    }
    return { success: true };
  }

  async linkRequirement(id: string, dto: LinkRequirementDto) {
    const testCase = await this.ensureExists(id);

    if (dto.requirementId === null || dto.requirementId === undefined) {
      // 空置清除关联
      return this.prisma.testCase.update({
        where: { id: testCase.id },
        data: { requirementId: null },
        include: CASE_INCLUDE,
      });
    }

    const requirement = await this.prisma.requirement.findUnique({ where: { id: BigInt(dto.requirementId) } });
    if (!requirement) {
      throw new BadRequestException('关联的需求不存在');
    }
    if (requirement.projectId !== testCase.projectId) {
      throw new BadRequestException('不能关联其他项目的需求');
    }

    // 重复关联同一需求 → 幂等返回当前记录
    return this.prisma.testCase.update({
      where: { id: testCase.id },
      data: { requirementId: requirement.id },
      include: CASE_INCLUDE,
    });
  }

  // —— 权限断言：TEST_CASE_WRITE 仅 QA/ADMIN ——
  assertWritable(role: string): void {
    if (!can('TEST_CASE_WRITE', role as never)) {
      throw new ForbiddenException('仅 QA / 管理员可维护用例');
    }
  }

  private async ensureExists(id: string) {
    const testCase = await this.prisma.testCase.findUnique({ where: { id: BigInt(id) } });
    if (!testCase) {
      throw new NotFoundException('用例不存在');
    }
    return testCase;
  }
}
