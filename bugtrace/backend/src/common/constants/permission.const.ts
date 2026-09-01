// T1-2 · 权限常量表（后端侧）：角色 × 操作的硬编码矩阵
// 依据：《MVP 文档》2.3 权限矩阵。MVP 不做库表化权限，直接常量维护。
import { Role } from '@prisma/client';

export type Action =
  | 'PROJECT_WRITE' // 创建/编辑项目、邀请成员
  | 'REQUIREMENT_WRITE' // 登记需求
  | 'TEST_CASE_WRITE' // 用例增删改、关联需求
  | 'TEST_PLAN_WRITE' // 创建测试计划
  | 'BUG_CREATE' // 提单
  | 'BUG_ASSIGN' // 分派
  | 'BUG_START' // 开始处理
  | 'BUG_FIX' // 填写修复
  | 'BUG_VERIFY' // 回归验证
  | 'BUG_CLOSE' // 关闭
  | 'BUG_REOPEN' // 重开
  | 'BUG_REJECT'; // 拒绝

const MATRIX: Record<Action, Role[]> = {
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
};

export function can(action: Action, role: Role): boolean {
  return MATRIX[action].includes(role);
}
