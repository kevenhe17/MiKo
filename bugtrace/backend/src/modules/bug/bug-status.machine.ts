// T3-1 · Bug 状态机（P3 唯一真相：后端流转校验与前端按钮显隐都从本文件推导）
// MVP 状态机：6 状态 + 重开 + 拒绝
//   NEW → ASSIGNED → IN_PROGRESS → FIXED → VERIFIED → CLOSED（主线）
//   重开：FIXED/VERIFIED → IN_PROGRESS
//   拒绝：ASSIGNED → CLOSED（经 reject 动作）
//   NEW → CLOSED 等跳步非法
import { Role } from '@prisma/client';

export type BugStatusString = 'NEW' | 'ASSIGNED' | 'IN_PROGRESS' | 'FIXED' | 'VERIFIED' | 'CLOSED';

export type BugAction = 'assign' | 'start' | 'fix' | 'verify' | 'close' | 'reopen' | 'reject';

/** 合法流转表（key: from, value: 合法 to 数组） */
export const TRANSITIONS: Record<BugStatusString, BugStatusString[]> = {
  NEW: ['ASSIGNED'],
  ASSIGNED: ['IN_PROGRESS', 'CLOSED'],
  IN_PROGRESS: ['FIXED'],
  FIXED: ['VERIFIED', 'IN_PROGRESS'],
  VERIFIED: ['CLOSED', 'IN_PROGRESS'],
  CLOSED: [],
};

/** 每个动作的定义：起点 → 终点 + 允许角色 */
export interface ActionDef {
  from: BugStatusString;
  to: BugStatusString;
  roles: Role[];
  label: string;
}

export const ACTIONS: Record<BugAction, ActionDef> = {
  assign: { from: 'NEW', to: 'ASSIGNED', roles: ['QA', 'ADMIN'], label: '分派' },
  start: { from: 'ASSIGNED', to: 'IN_PROGRESS', roles: ['DEV'], label: '开始处理' },
  fix: { from: 'IN_PROGRESS', to: 'FIXED', roles: ['DEV'], label: '填写修复' },
  // verify 的 to 由 passed 决定：true → VERIFIED；false → IN_PROGRESS（回归失败重开）
  verify: { from: 'FIXED', to: 'VERIFIED', roles: ['QA', 'ADMIN'], label: '回归验证' },
  close: { from: 'VERIFIED', to: 'CLOSED', roles: ['QA', 'ADMIN'], label: '关闭' },
  reopen: { from: 'FIXED', to: 'IN_PROGRESS', roles: ['QA', 'ADMIN'], label: '重开' },
  reject: { from: 'ASSIGNED', to: 'CLOSED', roles: ['ADMIN'], label: '拒绝' },
};

/** 重开动作额外允许 VERIFIED 起点（FIXED/VERIFIED → IN_PROGRESS） */
export const REOPEN_EXTRA_FROM: BugStatusString[] = ['VERIFIED'];

/** 当前状态下可执行某动作（含角色判断） */
export function canTransition(
  status: BugStatusString,
  action: BugAction,
  role: Role,
): boolean {
  const def = ACTIONS[action];
  if (!def) return false;
  if (!def.roles.includes(role)) return false;

  const legalFroms: BugStatusString[] =
    action === 'reopen' ? [def.from, ...REOPEN_EXTRA_FROM] : [def.from];
  if (!legalFroms.includes(status)) return false;

  const legalTargets = TRANSITIONS[status];
  const target = actionTarget(status, action);
  return target !== null && legalTargets.includes(target);
}

/** 返回动作的目标状态；起点不符返回 null。verify 的目标由 passed 决定 */
export function actionTarget(
  status: BugStatusString,
  action: BugAction,
  passed?: boolean,
): BugStatusString | null {
  const def = ACTIONS[action];
  if (!def) return null;
  if (action === 'verify') {
    if (status !== 'FIXED') return null;
    return passed === false ? 'IN_PROGRESS' : 'VERIFIED';
  }
  if (action === 'reopen') {
    return status === 'FIXED' || status === 'VERIFIED' ? 'IN_PROGRESS' : null;
  }
  return status === def.from ? def.to : null;
}

/** 当前状态的全部合法目标（错误提示用） */
export function legalTargetsOf(status: BugStatusString): BugStatusString[] {
  return [...TRANSITIONS[status]];
}

/** 校验并返回目标状态；非法时抛出的消息含「当前状态 + 合法目标」 */
export class IllegalTransitionError extends Error {}

export function assertTransition(
  status: BugStatusString,
  action: BugAction,
  role: Role,
  passed?: boolean,
): BugStatusString {
  const def = ACTIONS[action];
  if (!def) {
    throw new IllegalTransitionError(`未知动作：${action}`);
  }
  if (!def.roles.includes(role)) {
    throw new IllegalTransitionError(`角色 ${role} 无权执行「${def.label}」（允许角色：${def.roles.join('/')}）`);
  }
  const target = actionTarget(status, action, passed);
  if (target === null) {
    throw new IllegalTransitionError(
      `当前状态 ${status} 不能执行「${def.label}」；当前状态的合法目标：${legalTargetsOf(status).join('/') || '无（终态）'}`,
    );
  }
  return target;
}
