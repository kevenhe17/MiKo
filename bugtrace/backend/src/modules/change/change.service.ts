import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateChangeRequestDto } from './dto/change.dto';
import {
  assertCrTransition,
  IllegalCrTransitionError,
  type CrAction,
  type CrStatusString,
} from './change-status.machine';

const CR_INCLUDE = {
  owner: { select: { id: true, username: true, realname: true } },
  reviewer: { select: { id: true, username: true, realname: true } },
  merger: { select: { id: true, username: true, realname: true } },
} satisfies Prisma.ChangeRequestInclude;

@Injectable()
export class ChangeService {
  constructor(private readonly prisma: PrismaService) {}

  /** 创建 CR：DRAFT 态；code 生成 CR-{项目code}-{4位序号} */
  async create(dto: CreateChangeRequestDto, operator: { id: string; role: string }) {
    const project = await this.prisma.project.findUnique({ where: { id: BigInt(dto.projectId) } });
    if (!project) {
      throw new BadRequestException('所属项目不存在');
    }

    // 来源对象校验：BUG/REQUIREMENT 需存在且属于同项目
    if (dto.sourceId) {
      if (dto.sourceType === 'BUG') {
        const bug = await this.prisma.bug.findUnique({ where: { id: BigInt(dto.sourceId) } });
        if (!bug || bug.projectId !== project.id) {
          throw new BadRequestException('关联的 Bug 不存在或不属于该项目');
        }
      } else if (dto.sourceType === 'REQUIREMENT') {
        const req = await this.prisma.requirement.findUnique({ where: { id: BigInt(dto.sourceId) } });
        if (!req || req.projectId !== project.id) {
          throw new BadRequestException('关联的需求不存在或不属于该项目');
        }
      }
    }

    // 热修复类强制双向回流标记
    const backflowStatus =
      dto.type === 'HOTFIX' ? 'PENDING' : dto.dstBranch.startsWith('release/') ? 'PENDING' : null;

    const count = await this.prisma.changeRequest.count({ where: { projectId: project.id } });
    const seq = String(count + 1).padStart(4, '0');
    const code = `CR-${project.code}-${seq}`;
    if (await this.prisma.changeRequest.findUnique({ where: { code } })) {
      throw new BadRequestException('CR 编号生成冲突，请重试');
    }

    return this.prisma.$transaction(async (tx) => {
      const created = await tx.changeRequest.create({
        data: {
          projectId: project.id,
          code,
          title: dto.title,
          type: dto.type,
          sourceType: dto.sourceType,
          sourceId: dto.sourceId ? BigInt(dto.sourceId) : null,
          version: dto.version,
          srcBranch: dto.srcBranch,
          dstBranch: dto.dstBranch,
          riskLevel: dto.riskLevel ?? 'MEDIUM',
          needRegression: dto.needRegression ?? true,
          status: 'DRAFT',
          ownerId: BigInt(operator.id),
          backflowStatus,
        },
        include: CR_INCLUDE,
      });
      // 创建留痕（与 bug 模式一致）
      await tx.changeLog.create({
        data: {
          crId: created.id,
          operatorId: BigInt(operator.id),
          action: 'create',
          fromStatus: 'DRAFT',
          toStatus: 'DRAFT',
          comment: '创建变更单（草稿）',
        },
      });
      return created;
    });
  }

  /** 列表：projectId 必筛 + status/type/sourceType/sourceId/ownerId 可选 + 分页 */
  async list(
    filters: {
      projectId: number;
      status?: string;
      type?: string;
      sourceType?: string;
      sourceId?: number;
      ownerId?: number;
    },
    page = 1,
    pageSize = 10,
  ) {
    const where: Prisma.ChangeRequestWhereInput = { projectId: BigInt(filters.projectId) };
    if (filters.status) {
      where.status = filters.status as Prisma.EnumChangeStatusFilter;
    }
    if (filters.type) {
      where.type = filters.type;
    }
    if (filters.sourceType) {
      where.sourceType = filters.sourceType;
    }
    if (filters.sourceId) {
      where.sourceId = BigInt(filters.sourceId);
    }
    if (filters.ownerId) {
      where.ownerId = BigInt(filters.ownerId);
    }

    const skip = (page - 1) * pageSize;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.changeRequest.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: pageSize,
        include: CR_INCLUDE,
      }),
      this.prisma.changeRequest.count({ where }),
    ]);
    return { list: items, total, page, pageSize };
  }

  /** 详情：含流转流水（时间轴） */
  async detail(id: string) {
    const cr = await this.prisma.changeRequest.findUnique({
      where: { id: BigInt(id) },
      include: {
        ...CR_INCLUDE,
        project: { select: { id: true, code: true, name: true } },
        logs: {
          orderBy: { createdAt: 'desc' },
          include: { operator: { select: { id: true, username: true, realname: true } } },
        },
      },
    });
    if (!cr) {
      throw new NotFoundException('变更单不存在');
    }
    return cr;
  }

  /**
   * 通用流转：状态机校验 → 写状态 → 写流水，同一事务。
   * 越权 → 403；非法流转 → 400。approve/reject-review 需评审人 ≠ 负责人。
   */
  private async transition(
    id: string,
    action: CrAction,
    operator: { id: string; role: string },
    options: {
      comment?: string;
      requireComment?: boolean;
      extraData?: Prisma.ChangeRequestUpdateInput;
    } = {},
  ): Promise<void> {
    const cr = await this.prisma.changeRequest.findUnique({ where: { id: BigInt(id) } });
    if (!cr) {
      throw new NotFoundException('变更单不存在');
    }

    let toStatus: CrStatusString;
    try {
      toStatus = assertCrTransition(cr.status as CrStatusString, action, operator.role as never);
    } catch (e) {
      if (e instanceof IllegalCrTransitionError) {
        throw /无权/.test(e.message)
          ? new ForbiddenException(e.message)
          : new BadRequestException(e.message);
      }
      throw e;
    }

    if ((options.requireComment ?? false) && !options.comment) {
      throw new BadRequestException('备注/原因不能为空');
    }

    // 评审人 ≠ 负责人（双人原则，技术方案表 8-3）
    if ((action === 'approve' || action === 'reject-review') && cr.ownerId === BigInt(operator.id)) {
      throw new BadRequestException('评审人不能是 CR 负责人本人');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.changeRequest.update({
        where: { id: cr.id },
        data: {
          status: toStatus,
          ...(options.extraData ?? {}),
        },
      });
      await tx.changeLog.create({
        data: {
          crId: cr.id,
          operatorId: BigInt(operator.id),
          action,
          fromStatus: cr.status,
          toStatus,
          comment: options.comment,
        },
      });
    });
  }

  /** 提交评审：DRAFT → IN_REVIEW；自动带出评审人（首个 ADMIN 成员） */
  async submit(id: string, operator: { id: string; role: string }) {
    await this.transition(id, 'submit', operator);
    // 模拟「按目标分支 + 风险等级自动带出评审人」：取项目内首个 ADMIN
    const cr = await this.prisma.changeRequest.findUnique({ where: { id: BigInt(id) } });
    const admin = await this.prisma.user.findFirst({ where: { role: 'ADMIN' } });
    if (cr && admin) {
      await this.prisma.changeRequest.update({
        where: { id: cr.id },
        data: { reviewerId: admin.id },
      });
    }
    return this.detail(id);
  }

  /** 评审通过：IN_REVIEW → APPROVED（评审人 ≠ 负责人） */
  async approve(id: string, operator: { id: string; role: string }, comment?: string) {
    await this.transition(id, 'approve', operator, {
      comment: comment ?? '评审通过',
      extraData: { reviewer: { connect: { id: BigInt(operator.id) } } },
    });
    return this.detail(id);
  }

  /** 评审驳回：IN_REVIEW → DRAFT，理由必填 */
  async rejectReview(id: string, comment: string, operator: { id: string; role: string }) {
    await this.transition(id, 'reject-review', operator, { comment, requireComment: true });
    return this.detail(id);
  }

  /** 触发构建：APPROVED → BUILDING（模拟 CI 触发） */
  async startBuild(id: string, operator: { id: string; role: string }) {
    await this.transition(id, 'start-build', operator, { comment: '触发 CI 构建' });
    return this.detail(id);
  }

  /** 构建完成：BUILDING → REGRESSION（模拟 CI 回写） */
  async buildDone(id: string, operator: { id: string; role: string }, comment?: string) {
    await this.transition(id, 'build-done', operator, {
      comment: comment ?? '构建成功，进入回归',
    });
    return this.detail(id);
  }

  /** 回归完成：REGRESSION → GATE_CHECK */
  async regressionDone(id: string, operator: { id: string; role: string }, comment?: string) {
    await this.transition(id, 'regression-done', operator, {
      comment: comment ?? '回归执行完成',
    });
    return this.detail(id);
  }

  /** 门禁通过：GATE_CHECK → AWAITING_MERGE */
  async gatePass(id: string, operator: { id: string; role: string }, comment?: string) {
    await this.transition(id, 'gate-pass', operator, { comment: comment ?? '门禁校验全部通过' });
    return this.detail(id);
  }

  /** 合入：AWAITING_MERGE → MERGED；回写合入人/时间/sha，HOTFIX 标记待回流 */
  async merge(id: string, dto: { mergedSha?: string; comment?: string }, operator: { id: string; role: string }) {
    await this.transition(id, 'merge', operator, {
      comment: dto.comment ?? `已合入目标分支${dto.mergedSha ? `（${dto.mergedSha}）` : ''}`,
      extraData: {
        mergedAt: new Date(),
        merger: { connect: { id: BigInt(operator.id) } },
        mergedSha: dto.mergedSha ?? null,
      },
    });
    return this.detail(id);
  }

  /** 发布：MERGED → RELEASED；回填 Tag */
  async release(id: string, dto: { tag: string; comment?: string }, operator: { id: string; role: string }) {
    await this.transition(id, 'release', operator, {
      comment: dto.comment ?? `发布完成，Tag：${dto.tag}`,
      extraData: { tag: dto.tag },
    });
    return this.detail(id);
  }

  /** 废弃：任意非终态 → ABANDONED，原因必填（创建人/ADMIN） */
  async abandon(id: string, reason: string, operator: { id: string; role: string }) {
    const cr = await this.prisma.changeRequest.findUnique({ where: { id: BigInt(id) } });
    if (!cr) {
      throw new NotFoundException('变更单不存在');
    }
    const isOwner = cr.ownerId === BigInt(operator.id);
    if (!isOwner && operator.role !== 'ADMIN') {
      throw new ForbiddenException('仅创建人或管理员可废弃');
    }
    await this.transition(id, 'abandon', operator, { comment: reason, requireComment: true });
    return this.detail(id);
  }

  /** 回流完成：HOTFIX/release 类 CR 标记已回流（不改变状态） */
  async backflowDone(id: string, operator: { id: string; role: string }) {
    const cr = await this.prisma.changeRequest.findUnique({ where: { id: BigInt(id) } });
    if (!cr) {
      throw new NotFoundException('变更单不存在');
    }
    if (!cr.backflowStatus) {
      throw new BadRequestException('该 CR 无需回流');
    }
    await this.prisma.changeRequest.update({
      where: { id: cr.id },
      data: { backflowStatus: 'DONE' },
    });
    await this.prisma.changeLog.create({
      data: {
        crId: cr.id,
        operatorId: BigInt(operator.id),
        action: 'backflow-done',
        fromStatus: cr.status,
        toStatus: cr.status,
        comment: '回流完成（主干 + 发布分支）',
      },
    });
    return this.detail(id);
  }

  // —— T5-3 · 统计接口（报表与可视化数据源） ——

  /**
   * 总览指标：CR 总数、状态分布、类型分布、风险分布、
   * 平均流转时长（创建→合入）、待回流数。
   */
  async statsOverview(projectId: number) {
    const pid = BigInt(projectId);
    const [all, merged, pendingBackflow] = await this.prisma.$transaction([
      this.prisma.changeRequest.findMany({
        where: { projectId: pid },
        select: { status: true, type: true, riskLevel: true, createdAt: true, mergedAt: true },
      }),
      this.prisma.changeRequest.count({ where: { projectId: pid, mergedAt: { not: null } } }),
      this.prisma.changeRequest.count({
        where: { projectId: pid, backflowStatus: 'PENDING' },
      }),
    ]);

    // 分布聚合（数据量为项目级 CR 数，内存聚合足够）
    const byStatus: Record<string, number> = {};
    const byType: Record<string, number> = {};
    const byRisk: Record<string, number> = {};
    let mergeMsSum = 0;
    let mergeCount = 0;
    for (const cr of all) {
      byStatus[cr.status] = (byStatus[cr.status] ?? 0) + 1;
      byType[cr.type] = (byType[cr.type] ?? 0) + 1;
      byRisk[cr.riskLevel] = (byRisk[cr.riskLevel] ?? 0) + 1;
      if (cr.mergedAt) {
        mergeMsSum += cr.mergedAt.getTime() - cr.createdAt.getTime();
        mergeCount++;
      }
    }

    // 平均流转时长（小时，保留 1 位）：创建 → 合入
    const avgMergeHours =
      mergeCount > 0 ? Math.round((mergeMsSum / 3600000 / mergeCount) * 10) / 10 : 0;

    return {
      total: all.length,
      byStatus,
      byType,
      byRisk,
      avgMergeHours,
      mergedCount: merged,
      pendingBackflow,
    };
  }

  /**
   * 趋势：近 N 天（默认 14，上限 90）每日新建 CR 数与流转事件数。
   * 返回 days 数组：[{ date: 'MM-DD', created, transitions }]
   */
  async statsTrend(projectId: number, days = 14) {
    const pid = BigInt(projectId);
    const span = Math.min(90, Math.max(7, days));
    const since = new Date(Date.now() - (span - 1) * 86400000);
    since.setHours(0, 0, 0, 0);

    const [created, transitions] = await this.prisma.$transaction([
      this.prisma.changeRequest.findMany({
        where: { projectId: pid, createdAt: { gte: since } },
        select: { createdAt: true },
      }),
      this.prisma.changeLog.findMany({
        where: {
          cr: { projectId: pid },
          createdAt: { gte: since },
          action: { not: 'backflow-done' },
        },
        select: { createdAt: true },
      }),
    ]);

    // 按日聚合
    const byDay = new Map<string, { created: number; transitions: number }>();
    for (let i = 0; i < span; i++) {
      const d = new Date(since.getTime() + i * 86400000);
      byDay.set(this.dayKey(d), { created: 0, transitions: 0 });
    }
    for (const c of created) {
      const key = this.dayKey(c.createdAt);
      const entry = byDay.get(key);
      if (entry) entry.created++;
    }
    for (const t of transitions) {
      const key = this.dayKey(t.createdAt);
      const entry = byDay.get(key);
      if (entry) entry.transitions++;
    }

    return {
      days: span,
      series: Array.from(byDay.entries()).map(([date, v]) => ({ date, ...v })),
    };
  }

  /** 待回流清单：backflow=PENDING 的 CR（含负责人与合入时间，供催办） */
  async statsBackflow(projectId: number) {
    return this.prisma.changeRequest.findMany({
      where: { projectId: BigInt(projectId), backflowStatus: 'PENDING' },
      orderBy: { mergedAt: 'asc' },
      select: {
        id: true,
        code: true,
        title: true,
        type: true,
        status: true,
        srcBranch: true,
        dstBranch: true,
        mergedAt: true,
        backflowStatus: true,
        owner: { select: { id: true, username: true, realname: true } },
      },
    });
  }

  private dayKey(d: Date): string {
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${m}-${day}`;
  }
}
