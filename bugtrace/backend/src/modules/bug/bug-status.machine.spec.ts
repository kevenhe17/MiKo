// T3-1 · 状态机单元测试：每个 from 的合法 to 集合与拒绝集合逐一断言
import {
  TRANSITIONS,
  ACTIONS,
  canTransition,
  actionTarget,
  assertTransition,
  IllegalTransitionError,
  type BugStatusString,
  type BugAction,
} from './bug-status.machine';
import { Role } from '@prisma/client';

describe('TRANSITIONS 流转表', () => {
  it('主线：NEW→ASSIGNED→IN_PROGRESS→FIXED→VERIFIED→CLOSED 全部合法', () => {
    expect(TRANSITIONS.NEW).toContain('ASSIGNED');
    expect(TRANSITIONS.ASSIGNED).toContain('IN_PROGRESS');
    expect(TRANSITIONS.IN_PROGRESS).toContain('FIXED');
    expect(TRANSITIONS.FIXED).toContain('VERIFIED');
    expect(TRANSITIONS.VERIFIED).toContain('CLOSED');
  });

  it('重开：FIXED→IN_PROGRESS 与 VERIFIED→IN_PROGRESS 合法', () => {
    expect(TRANSITIONS.FIXED).toContain('IN_PROGRESS');
    expect(TRANSITIONS.VERIFIED).toContain('IN_PROGRESS');
  });

  it('拒绝：ASSIGNED→CLOSED（经 reject 动作）合法', () => {
    expect(TRANSITIONS.ASSIGNED).toContain('CLOSED');
  });

  it('跳步非法：NEW→CLOSED / NEW→FIXED / ASSIGNED→VERIFIED 不在合法目标内', () => {
    expect(TRANSITIONS.NEW).not.toContain('CLOSED');
    expect(TRANSITIONS.NEW).not.toContain('FIXED');
    expect(TRANSITIONS.ASSIGNED).not.toContain('VERIFIED');
  });

  it('CLOSED 为终态，无合法目标', () => {
    expect(TRANSITIONS.CLOSED).toEqual([]);
  });

  it('每个状态的拒绝集合断言（穷举所有状态两两组合）', () => {
    const all: BugStatusString[] = ['NEW', 'ASSIGNED', 'IN_PROGRESS', 'FIXED', 'VERIFIED', 'CLOSED'];
    const legal = new Set<string>(all.map((from) => TRANSITIONS[from].map((to) => `${from}->${to}`)).flat());
    for (const from of all) {
      for (const to of all) {
        if (from === to) continue;
        if (!legal.has(`${from}->${to}`)) {
          // 非法跳转不应出现在流转表中
          expect(TRANSITIONS[from]).not.toContain(to);
        }
      }
    }
  });
});

describe('canTransition 角色权限', () => {
  it('assign：QA/ADMIN 合法，DEV 非法', () => {
    expect(canTransition('NEW', 'assign', 'QA')).toBe(true);
    expect(canTransition('NEW', 'assign', 'ADMIN')).toBe(true);
    expect(canTransition('NEW', 'assign', 'DEV')).toBe(false);
  });

  it('start/fix：DEV 合法，QA/ADMIN 非法', () => {
    expect(canTransition('ASSIGNED', 'start', 'DEV')).toBe(true);
    expect(canTransition('ASSIGNED', 'start', 'QA')).toBe(false);
    expect(canTransition('IN_PROGRESS', 'fix', 'DEV')).toBe(true);
    expect(canTransition('IN_PROGRESS', 'fix', 'ADMIN')).toBe(false);
  });

  it('verify/close/reopen：QA/ADMIN 合法，DEV 非法', () => {
    expect(canTransition('FIXED', 'verify', 'QA')).toBe(true);
    expect(canTransition('FIXED', 'verify', 'ADMIN')).toBe(true);
    expect(canTransition('FIXED', 'verify', 'DEV')).toBe(false);
    expect(canTransition('VERIFIED', 'close', 'QA')).toBe(true);
    expect(canTransition('VERIFIED', 'close', 'DEV')).toBe(false);
    expect(canTransition('FIXED', 'reopen', 'QA')).toBe(true);
    expect(canTransition('VERIFIED', 'reopen', 'ADMIN')).toBe(true);
    expect(canTransition('FIXED', 'reopen', 'DEV')).toBe(false);
  });

  it('reject：仅 ADMIN 合法', () => {
    expect(canTransition('ASSIGNED', 'reject', 'ADMIN')).toBe(true);
    expect(canTransition('ASSIGNED', 'reject', 'QA')).toBe(false);
    expect(canTransition('ASSIGNED', 'reject', 'DEV')).toBe(false);
  });
});

describe('canTransition 状态前提', () => {
  const cases: Array<[BugAction, BugStatusString, Role]> = [
    ['assign', 'ASSIGNED', 'QA'], // assign 只能从 NEW 起
    ['start', 'NEW', 'DEV'],
    ['start', 'IN_PROGRESS', 'DEV'],
    ['fix', 'FIXED', 'DEV'],
    ['verify', 'IN_PROGRESS', 'QA'],
    ['verify', 'VERIFIED', 'QA'],
    ['close', 'FIXED', 'QA'],
    ['close', 'NEW', 'QA'],
    ['reopen', 'NEW', 'QA'],
    ['reopen', 'ASSIGNED', 'QA'],
    ['reject', 'NEW', 'ADMIN'],
    ['reject', 'IN_PROGRESS', 'ADMIN'],
  ];
  it.each(cases)('非法起点被拒绝：%s from %s', (action, status, role) => {
    expect(canTransition(status, action, role)).toBe(false);
  });
});

describe('actionTarget / assertTransition', () => {
  it('verify passed=false → IN_PROGRESS（回归失败）', () => {
    expect(actionTarget('FIXED', 'verify', false)).toBe('IN_PROGRESS');
    expect(actionTarget('FIXED', 'verify', true)).toBe('VERIFIED');
  });

  it('NEW 直接 close → 抛错且消息含当前状态与合法目标', () => {
    expect(() => assertTransition('NEW', 'close', 'QA')).toThrow(IllegalTransitionError);
    try {
      assertTransition('NEW', 'close', 'QA');
    } catch (e) {
      expect((e as Error).message).toContain('NEW');
      expect((e as Error).message).toContain('ASSIGNED');
    }
  });

  it('越权动作抛错（DEV assign）', () => {
    expect(() => assertTransition('NEW', 'assign', 'DEV')).toThrow(/无权/);
  });

  it('合法动作返回目标状态', () => {
    expect(assertTransition('NEW', 'assign', 'QA')).toBe('ASSIGNED');
    expect(assertTransition('ASSIGNED', 'reject', 'ADMIN')).toBe('CLOSED');
    expect(assertTransition('FIXED', 'verify', 'QA', false)).toBe('IN_PROGRESS');
  });

  it('ACTIONS 覆盖 7 个动作', () => {
    expect(Object.keys(ACTIONS).sort()).toEqual(
      ['assign', 'close', 'fix', 'reject', 'reopen', 'start', 'verify'].sort(),
    );
  });
});
