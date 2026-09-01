// T3-6 · 前端 Bug 状态机矩阵（与后端 bug-status.machine.ts 保持一致）
// 按钮显隐完全由本表推导：改矩阵即改按钮，不写死 UI 逻辑
export type BugStatus =
  | 'NEW'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'FIXED'
  | 'VERIFIED'
  | 'CLOSED';

export type BugAction = 'assign' | 'start' | 'fix' | 'verify' | 'close' | 'reopen' | 'reject';

export type Role = 'ADMIN' | 'DEV' | 'QA';

interface ActionDef {
  from: BugStatus[];
  roles: Role[];
}

/** 动作定义：合法起点（reopen 额外允许 VERIFIED）+ 允许角色 */
const ACTIONS: Record<BugAction, ActionDef> = {
  assign: { from: ['NEW'], roles: ['QA', 'ADMIN'] },
  start: { from: ['ASSIGNED'], roles: ['DEV'] },
  fix: { from: ['IN_PROGRESS'], roles: ['DEV'] },
  verify: { from: ['FIXED'], roles: ['QA', 'ADMIN'] },
  close: { from: ['VERIFIED'], roles: ['QA', 'ADMIN'] },
  reopen: { from: ['FIXED', 'VERIFIED'], roles: ['QA', 'ADMIN'] },
  reject: { from: ['ASSIGNED'], roles: ['ADMIN'] },
};

export function canTransition(status: BugStatus, action: BugAction, role: Role): boolean {
  const def = ACTIONS[action];
  if (!def) return false;
  return def.from.includes(status) && def.roles.includes(role);
}

/**
 * 当前状态 × 角色下可见的按钮动作列表。
 * verify 特殊：回归验证拆「通过/失败」两个入口，由调用方展开。
 */
export function visibleActions(status: BugStatus, role: Role): BugAction[] {
  return (Object.keys(ACTIONS) as BugAction[]).filter((action) =>
    canTransition(status, action, role),
  );
}

export const ACTION_LABELS: Record<BugAction, string> = {
  assign: '分派',
  start: '开始处理',
  fix: '填写修复',
  verify: '回归验证',
  close: '关闭',
  reopen: '重开',
  reject: '拒绝',
};

export const STATUS_LABELS: Record<BugStatus, string> = {
  NEW: '新建',
  ASSIGNED: '已分派',
  IN_PROGRESS: '处理中',
  FIXED: '已修复',
  VERIFIED: '已验证',
  CLOSED: '已关闭',
};

export const SEVERITY_LABELS: Record<string, string> = {
  BLOCKER: '致命',
  CRITICAL: '严重',
  MAJOR: '一般',
  MINOR: '轻微',
};
