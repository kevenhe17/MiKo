// T1-5 · 前端权限常量表（集中维护，业务组件禁止散落 role 字面量比较）
// 依据：《MVP 文档》2.3 权限矩阵；T2-4 扩展用例/计划权限点
export type Permission =
  | 'PROJECT_WRITE'
  | 'REQUIREMENT_WRITE'
  | 'TEST_CASE_WRITE'
  | 'TEST_PLAN_WRITE'
  | 'BUG_CREATE'
  | 'BUG_ASSIGN'
  | 'BUG_START'
  | 'BUG_FIX'
  | 'BUG_VERIFY'
  | 'BUG_CLOSE'
  | 'BUG_REOPEN'
  | 'BUG_REJECT'
  | 'CHANGE_VIEW';

export type Role = 'ADMIN' | 'DEV' | 'QA';

const MATRIX: Record<Permission, Role[]> = {
  PROJECT_WRITE: ['ADMIN'],
  REQUIREMENT_WRITE: ['ADMIN'],
  TEST_CASE_WRITE: ['QA', 'ADMIN'],
  TEST_PLAN_WRITE: ['QA', 'ADMIN'],
  BUG_CREATE: ['QA', 'ADMIN'],
  BUG_ASSIGN: ['QA', 'ADMIN'],
  BUG_START: ['DEV'],
  BUG_FIX: ['DEV'],
  BUG_VERIFY: ['QA', 'ADMIN'],
  BUG_CLOSE: ['QA', 'ADMIN'],
  BUG_REOPEN: ['QA', 'ADMIN'],
  BUG_REJECT: ['ADMIN'],
  CHANGE_VIEW: ['QA', 'ADMIN'],
};

/** 判断当前用户是否具备某权限点 */
export function can(role: Role | undefined, permission: Permission): boolean {
  if (!role) return false;
  return MATRIX[permission].includes(role);
}

/** 菜单可见性：与权限矩阵一致（ADMIN 全量；QA 用例/计划/Bug/变更；DEV 仅 Bug） */
export const MENUS: Record<Role, Array<{ path: string; title: string; permission?: Permission }>> = {
  ADMIN: [
    { path: '/projects', title: '项目管理', permission: 'PROJECT_WRITE' },
    { path: '/requirements', title: '需求管理' },
    { path: '/cases', title: '测试用例' },
    { path: '/plans', title: '测试计划' },
    { path: '/bugs', title: '缺陷跟踪' },
    { path: '/changes', title: '变更流转', permission: 'CHANGE_VIEW' },
  ],
  QA: [
    { path: '/cases', title: '测试用例' },
    { path: '/plans', title: '测试计划' },
    { path: '/bugs', title: '缺陷跟踪' },
    { path: '/changes', title: '变更流转', permission: 'CHANGE_VIEW' },
  ],
  DEV: [
    { path: '/bugs', title: '缺陷跟踪' },
  ],
};
