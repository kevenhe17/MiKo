import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateBugDto } from './dto/bug.dto';
import { AssignBugDto, FixBugDto, VerifyBugDto } from './dto/bug-transition.dto';
import { can } from '../../common/constants/permission.const';
import { assertTransition, IllegalTransitionError, type BugAction, type BugStatusString } from './bug-status.machine';

const BUG_INCLUDE = {
  owner: { select: { id: true, username: true, realname: true } },
  fixer: { select: { id: true, username: true, realname: true } },
  requirement: { select: { id: true, code: true, title: true } },
  case: { select: { id: true, module: true, title: true, priority: true } },
} satisfies Prisma.BugInclude;

@Injectable()
export class BugService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateBugDto) {
    const project = await this.prisma.project.findUnique({ where: { id: BigInt(dto.projectId) } });
    if (!project) {
      throw new BadRequestException('所属项目不存在');
    }

    // 可选关联校验：需求/用例必须属于同项目
    if (dto.requirementId) {
      const requirement = await this.prisma.requirement.findUnique({ where: { id: BigInt(dto.requirementId) } });
      if (!requirement || requirement.projectId !== project.id) {
        throw new BadRequestException('关联的需求不存在或不属于该项目');
      }
    }
    if (dto.caseId) {
      const testCase = await this.prisma.testCase.findUnique({ where: { id: BigInt(dto.caseId) } });
      if (!testCase || testCase.projectId !== project.id) {
        throw new BadRequestException('关联的用例不存在或不属于该项目');
      }
    }

    // code 生成：BUG-{项目code}-{4位序号}
    const count = await this.prisma.bug.count({ where: { projectId: project.id } });
    const seq = String(count + 1).padStart(4, '0');
    const code = `BUG-${project.code}-${seq}`;
    if (await this.prisma.bug.findUnique({ where: { code } })) {
      throw new BadRequestException('Bug 编号生成冲突，请重试');
    }

    const created = await this.prisma.bug.create({
      data: {
        projectId: project.id,
        code,
        title: dto.title,
        severity: dto.severity,
        priority: dto.priority,
        status: 'NEW',
        module: dto.module,
        environment: dto.environment,
        steps: dto.steps,
        expected: dto.expected,
        actual: dto.actual,
        requirementId: dto.requirementId ? BigInt(dto.requirementId) : null,
        caseId: dto.caseId ? BigInt(dto.caseId) : null,
      },
      include: BUG_INCLUDE,
    });

    // T3-5 · 回填附件归属：提单时截图已先上传（targetId=0 占位），此处挂到新 Bug
    if (dto.attachmentIds?.length) {
      await this.prisma.attachment.updateMany({
        where: {
          id: { in: dto.attachmentIds.map((id) => BigInt(id)) },
          projectId: project.id, // 只允许挂同项目的附件
          targetType: 'bug',
        },
        data: { targetId: created.id },
      });
    }

    return created;
  }

  /**
   * 列表：status/severity/ownerId 筛选 + 分页。
   * DEV 视角服务端过滤：仅返回 owner_id 或 fixer_id 为自己的 Bug。
   */
  async list(
    filters: { status?: string; severity?: string; ownerId?: number },
    viewer: { id: string; role: string },
    page = 1,
    pageSize = 10,
  ) {
    const where: Prisma.BugWhereInput = {};
    if (filters.status) {
      where.status = filters.status as Prisma.EnumBugStatusFilter;
    }
    if (filters.severity) {
      where.severity = filters.severity as Prisma.EnumBugSeverityFilter;
    }
    if (filters.ownerId) {
      where.ownerId = BigInt(filters.ownerId);
    }

    if (viewer.role === 'DEV') {
      // 服务端数据边界，不是前端过滤
      const me = BigInt(viewer.id);
      where.OR = [{ ownerId: me }, { fixerId: me }];
    }

    const skip = (page - 1) * pageSize;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.bug.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: pageSize,
        include: BUG_INCLUDE,
      }),
      this.prisma.bug.count({ where }),
    ]);
    return { list: items, total, page, pageSize };
  }

  async detail(id: string) {
    const bug = await this.prisma.bug.findUnique({
      where: { id: BigInt(id) },
      include: {
        ...BUG_INCLUDE,
        project: { select: { id: true, code: true, name: true } },
        logs: {
          orderBy: { createdAt: 'desc' },
          include: { operator: { select: { id: true, username: true, realname: true } } },
        },
      },
    });
    if (!bug) {
      throw new NotFoundException('Bug 不存在');
    }
    // attachment 为多态引用（targetType/targetId，无物理外键），手动查询
    const attachments = await this.prisma.attachment.findMany({
      where: { targetType: 'bug', targetId: bug.id },
      orderBy: { createdAt: 'asc' },
    });
    // T5-2 · 关联变更单（变更流转域反向追溯：Bug → CR 列表）
    const changes = await this.prisma.changeRequest.findMany({
      where: { sourceType: 'BUG', sourceId: bug.id },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true, code: true, title: true, type: true, status: true,
        srcBranch: true, dstBranch: true, riskLevel: true, updatedAt: true,
      },
    });
    return { ...bug, attachments, changes };
  }

  // —— 权限断言：提单仅 QA/ADMIN ——
  assertCreatable(role: string): void {
    if (!can('BUG_CREATE', role as never)) {
      throw new ForbiddenException('仅 QA / 管理员可提单');
    }
  }

  /**
   * T3-2 · 通用流转：状态机校验 → 写状态 → 写流水，三步同一事务。
   * 越权 → 403；非法流转 → 400（消息含当前状态 + 合法目标）。
   */
  private async transition(
    id: string,
    action: BugAction,
    operator: { id: string; role: string },
    options: {
      passed?: boolean;
      comment?: string;
      extraBugData?: Prisma.BugUpdateInput;
      requireComment?: boolean;
    } = {},
  ): Promise<void> {
    const bug = await this.prisma.bug.findUnique({ where: { id: BigInt(id) } });
    if (!bug) {
      throw new NotFoundException('Bug 不存在');
    }

    let toStatus: BugStatusString;
    try {
      toStatus = assertTransition(bug.status as BugStatusString, action, operator.role as never, options.passed);
    } catch (e) {
      if (e instanceof IllegalTransitionError) {
        const def = /无权/.test(e.message)
          ? new ForbiddenException(e.message) // 越权 → 403
          : new BadRequestException(e.message); // 非法流转 → 400
        throw def;
      }
      throw e;
    }

    if (options.requireComment && !options.comment) {
      throw new BadRequestException('备注不能为空');
    }

    // 状态变更 + 流水写入：同一事务（流水只增不改不删）
    await this.prisma.$transaction(async (tx) => {
      await tx.bug.update({
        where: { id: bug.id },
        data: {
          status: toStatus,
          ...(options.extraBugData ?? {}),
        },
      });
      await tx.bugLog.create({
        data: {
          bugId: bug.id,
          operatorId: BigInt(operator.id),
          action,
          fromStatus: bug.status,
          toStatus,
          comment: options.comment,
        },
      });
    });
  }

  /** 分派：QA/ADMIN，body: ownerId + comment */
  async assign(id: string, dto: AssignBugDto, operator: { id: string; role: string }) {
    const owner = await this.prisma.user.findUnique({ where: { id: BigInt(dto.ownerId) } });
    if (!owner) {
      throw new BadRequestException('被分派的用户不存在');
    }
    await this.transition(id, 'assign', operator, {
      comment: dto.comment,
      extraBugData: { owner: { connect: { id: owner.id } } },
    });
    return this.detail(id);
  }

  /** 开始处理：DEV，自动置 fixer_id = 自己 */
  async start(id: string, operator: { id: string; role: string }) {
    await this.transition(id, 'start', operator, {
      extraBugData: { fixer: { connect: { id: BigInt(operator.id) } } },
    });
    return this.detail(id);
  }

  /** 填写修复：DEV，三件套必填 */
  async fix(id: string, dto: FixBugDto, operator: { id: string; role: string }) {
    await this.transition(id, 'fix', operator, {
      comment: `修复说明：${dto.fixDesc}`,
      extraBugData: {
        rootCause: dto.rootCause,
        fixDesc: dto.fixDesc,
        impact: dto.impact,
      },
    });
    return this.detail(id);
  }

  /** 回归验证：QA/ADMIN；passed=false → 回 IN_PROGRESS 且追加「回归失败」流水 */
  async verify(id: string, dto: VerifyBugDto, operator: { id: string; role: string }) {
    await this.transition(id, 'verify', operator, {
      passed: dto.passed,
      comment: dto.passed ? dto.comment ?? '回归验证通过' : `回归失败：${dto.comment ?? '未通过'}`,
    });
    if (!dto.passed) {
      // 回归失败路径额外追加一条「回归失败重开」流水（FIXED→IN_PROGRESS 两条留痕）
      const bug = await this.prisma.bug.findUnique({ where: { id: BigInt(id) } });
      if (bug) {
        await this.prisma.bugLog.create({
          data: {
            bugId: bug.id,
            operatorId: BigInt(operator.id),
            action: 'reopen',
            fromStatus: 'FIXED',
            toStatus: 'IN_PROGRESS',
            comment: '回归失败，自动重开（reopen）',
          },
        });
      }
    }
    return this.detail(id);
  }

  /** 关闭：QA/ADMIN */
  async close(id: string, operator: { id: string; role: string }, comment?: string) {
    await this.transition(id, 'close', operator, { comment: comment ?? '验证通过，关闭缺陷' });
    return this.detail(id);
  }

  /** 重开：QA/ADMIN，body: comment 必填 */
  async reopen(id: string, comment: string, operator: { id: string; role: string }) {
    await this.transition(id, 'reopen', operator, { comment, requireComment: true });
    return this.detail(id);
  }

  /** 拒绝：ADMIN，body: reason 必填 */
  async reject(id: string, reason: string, operator: { id: string; role: string }) {
    await this.transition(id, 'reject', operator, { comment: `拒绝原因：${reason}`, requireComment: true });
    return this.detail(id);
  }
}
