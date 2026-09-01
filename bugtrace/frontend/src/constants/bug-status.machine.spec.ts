// T3-6 · 按钮可见性单元测试：角色 × 状态矩阵与 MVP 2.3 逐项核对
import { describe, expect, it } from 'vitest';
import { canTransition, visibleActions } from './bug-status.machine';

const STATUSES = ['NEW', 'ASSIGNED', 'IN_PROGRESS', 'FIXED', 'VERIFIED', 'CLOSED'] as const;

describe('visibleActions · MVP 2.3 按钮矩阵', () => {
  it('NEW → QA/ADMIN 见「分派」，DEV 无按钮', () => {
    expect(visibleActions('NEW', 'QA')).toEqual(['assign']);
    expect(visibleActions('NEW', 'ADMIN')).toEqual(['assign']);
    expect(visibleActions('NEW', 'DEV')).toEqual([]);
  });

  it('ASSIGNED → DEV 见「开始处理」，ADMIN 见「拒绝」，QA 无按钮', () => {
    expect(visibleActions('ASSIGNED', 'DEV')).toEqual(['start']);
    expect(visibleActions('ASSIGNED', 'ADMIN')).toEqual(['reject']);
    expect(visibleActions('ASSIGNED', 'QA')).toEqual([]);
  });

  it('IN_PROGRESS → 仅 DEV 见「填写修复」', () => {
    expect(visibleActions('IN_PROGRESS', 'DEV')).toEqual(['fix']);
    expect(visibleActions('IN_PROGRESS', 'QA')).toEqual([]);
    expect(visibleActions('IN_PROGRESS', 'ADMIN')).toEqual([]);
  });

  it('FIXED → QA/ADMIN 见「回归验证 + 重开」，DEV 无按钮', () => {
    expect(visibleActions('FIXED', 'QA')).toEqual(['verify', 'reopen']);
    expect(visibleActions('FIXED', 'ADMIN')).toEqual(['verify', 'reopen']);
    expect(visibleActions('FIXED', 'DEV')).toEqual([]);
  });

  it('VERIFIED → QA/ADMIN 见「关闭 + 重开」，DEV 无按钮', () => {
    expect(visibleActions('VERIFIED', 'QA')).toEqual(['close', 'reopen']);
    expect(visibleActions('VERIFIED', 'ADMIN')).toEqual(['close', 'reopen']);
    expect(visibleActions('VERIFIED', 'DEV')).toEqual([]);
  });

  it('CLOSED → 终态，所有角色无按钮', () => {
    expect(visibleActions('CLOSED', 'QA')).toEqual([]);
    expect(visibleActions('CLOSED', 'DEV')).toEqual([]);
    expect(visibleActions('CLOSED', 'ADMIN')).toEqual([]);
  });

  it('越权动作在 UI 层不存在入口（canTransition 全矩阵断言）', () => {
    // DEV 只允许 start / fix；QA 不允许 start/fix/reject；ADMIN 全部业务动作但同样受状态限制
    for (const status of STATUSES) {
      for (const action of ['start', 'fix'] as const) {
        expect(canTransition(status, action, 'QA')).toBe(false);
        expect(canTransition(status, action, 'ADMIN')).toBe(false);
      }
      expect(canTransition(status, 'reject', 'QA')).toBe(false);
      expect(canTransition(status, 'reject', 'DEV')).toBe(false);
    }
  });
});
