// T5-2 · 变更单（CR）状态机（唯一真相：后端流转校验与前端按钮显隐共用）
// 依据：《技术方案》8.3 精简版 —— 9 主态 + 1 终态，10 条流转
//   DRAFT → IN_REVIEW → APPROVED → BUILDING → REGRESSION → GATE_CHECK → AWAITING_MERGE → MERGED → RELEASED（主线 9 条）
//   待评审驳回：IN_REVIEW → DRAFT
//   任意态废弃：* → ABANDONED（需原因）
// 降级设计：合入冲突/回滚不做状态，用 conflict_files / rolled_back 标记字段表达
import { ChangeStatus, Role } from '@prisma/client';

export type CrStatusString =
  | 'DRAFT'
  | 'IN_REVIEW'
  | 'APPROVED'
  | 'BUILDING'
  | 'REGRESSION'
  | 'GATE_CHECK'
  | 'AWAITING_MERGE'
  | 'MERGED'
  | 'RELEASED'
  | 'ABANDONED';

export type CrAction =
  | 'submit' // 草稿 → 待评审
  | 'approve' // 待评审 → 已批准
  | 'reject-review' // 待评审 → 草稿（驳回）
  | 'start-build' // 已批准 → 构建中
  | 'build-done' // 构建中 → 待回归
  | 'regression-done' // 待回归 → 门禁校验
  | 'gate-pass' // 门禁校验 → 待合入
  | 'merge' // 待合入 → 已合入
  | 'release' // 已合入 → 已发布
  | 'abandon'; // 任意态 → 已废弃

export interface CrActionDef {
  from: CrStatusString | '*';
  to: CrStatusString;
  roles: Role[];
  label: string;
  requireComment?: boolean;
}

export const CR_ACTIONS: Record<CrAction, CrActionDef> = {
  submit: { from: 'DRAFT', to: 'IN_REVIEW', roles: ['DEV', 'ADMIN'], label: '提交评审' },
  approve: { from: 'IN_REVIEW', to: 'APPROVED', roles: ['DEV', 'ADMIN'], label: '评审通过' },
  'reject-review': { from: 'IN_REVIEW', to: 'DRAFT', roles: ['DEV', 'ADMIN'], label: '评审驳回', requireComment: true },
  // 「系统自动」流转在 MVP 中由手动触发端点模拟（无外部 CI/GitLab 集成）
  'start-build': { from: 'APPROVED', to: 'BUILDING', roles: ['ADMIN'], label: '触发构建' },
  'build-done': { from: 'BUILDING', to: 'REGRESSION', roles: ['ADMIN'], label: '构建完成' },
  'regression-done': { from: 'REGRESSION', to: 'GATE_CHECK', roles: ['QA', 'ADMIN'], label: '回归完成' },
  'gate-pass': { from: 'GATE_CHECK', to: 'AWAITING_MERGE', roles: ['ADMIN'], label: '门禁通过' },
  merge: { from: 'AWAITING_MERGE', to: 'MERGED', roles: ['ADMIN'], label: '合入目标分支' },
  release: { from: 'MERGED', to: 'RELEASED', roles: ['ADMIN'], label: '发布' },
  abandon: { from: '*', to: 'ABANDONED', roles: ['DEV', 'QA', 'ADMIN'], label: '废弃', requireComment: true },
};

/** 终态不可流转 */
export const CR_TERMINAL: CrStatusString[] = ['RELEASED', 'ABANDONED'];

export class IllegalCrTransitionError extends Error {}

/** 校验动作合法性，返回目标状态；非法时消息含「当前状态 + 动作 + 允许角色」 */
export function assertCrTransition(
  status: CrStatusString,
  action: CrAction,
  role: Role,
): CrStatusString {
  const def = CR_ACTIONS[action];
  if (!def) {
    throw new IllegalCrTransitionError(`未知动作：${action}`);
  }
  if (!def.roles.includes(role)) {
    throw new IllegalCrTransitionError(
      `角色 ${role} 无权执行「${def.label}」（允许角色：${def.roles.join('/')}）`,
    );
  }
  if (CR_TERMINAL.includes(status)) {
    throw new IllegalCrTransitionError(`当前状态 ${status} 为终态，不能再流转`);
  }
  if (def.from !== '*' && status !== def.from) {
    throw new IllegalCrTransitionError(
      `当前状态 ${status} 不能执行「${def.label}」（该动作要求起点：${def.from}）`,
    );
  }
  return def.to;
}

/** 当前状态下某角色可执行的动作列表（前端按钮显隐用） */
export function availableCrActions(status: CrStatusString, role: Role): CrAction[] {
  return (Object.keys(CR_ACTIONS) as CrAction[]).filter((a) => {
    const def = CR_ACTIONS[a];
    if (!def.roles.includes(role)) return false;
    if (CR_TERMINAL.includes(status)) return false;
    return def.from === '*' || def.from === status;
  });
}
