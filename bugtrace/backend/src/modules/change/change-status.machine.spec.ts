// T5-2 · CR 状态机单元测试：10 条流转逐一断言 + 角色越权 + 终态拦截
import {
  CR_ACTIONS,
  CR_TERMINAL,
  assertCrTransition,
  availableCrActions,
  IllegalCrTransitionError,
  type CrStatusString,
  type CrAction,
} from './change-status.machine';
import { Role } from '@prisma/client';

describe('CR_ACTIONS 流转表（10 条）', () => {
  it('主线 9 条：DRAFT→IN_REVIEW→APPROVED→BUILDING→REGRESSION→GATE_CHECK→AWAITING_MERGE→MERGED→RELEASED', () => {
    const mainline: Array<[CrAction, CrStatusString, CrStatusString]> = [
      ['submit', 'DRAFT', 'IN_REVIEW'],
      ['approve', 'IN_REVIEW', 'APPROVED'],
      ['start-build', 'APPROVED', 'BUILDING'],
      ['build-done', 'BUILDING', 'REGRESSION'],
      ['regression-done', 'REGRESSION', 'GATE_CHECK'],
      ['gate-pass', 'GATE_CHECK', 'AWAITING_MERGE'],
      ['merge', 'AWAITING_MERGE', 'MERGED'],
      ['release', 'MERGED', 'RELEASED'],
    ];
    for (const [action, from, to] of mainline) {
      expect(CR_ACTIONS[action].from).toBe(from);
      expect(CR_ACTIONS[action].to).toBe(to);
    }
  });

  it('异常 2 条：驳回 IN_REVIEW→DRAFT；废弃 *→ABANDONED', () => {
    expect(CR_ACTIONS['reject-review'].to).toBe('DRAFT');
    expect(CR_ACTIONS.abandon.from).toBe('*');
    expect(CR_ACTIONS.abandon.to).toBe('ABANDONED');
  });

  it('终态：RELEASED / ABANDONED 不可再流转', () => {
    expect(CR_TERMINAL).toEqual(['RELEASED', 'ABANDONED']);
    for (const terminal of CR_TERMINAL) {
      expect(() => assertCrTransition(terminal, 'abandon', 'ADMIN')).toThrow(IllegalCrTransitionError);
    }
  });
});

describe('assertCrTransition 校验', () => {
  it('主线全程按序流转合法', () => {
    let s: CrStatusString = 'DRAFT';
    const steps: Array<[CrAction, Role]> = [
      ['submit', 'DEV'],
      ['approve', 'ADMIN'],
      ['start-build', 'ADMIN'],
      ['build-done', 'ADMIN'],
      ['regression-done', 'QA'],
      ['gate-pass', 'ADMIN'],
      ['merge', 'ADMIN'],
      ['release', 'ADMIN'],
    ];
    for (const [action, role] of steps) {
      s = assertCrTransition(s, action, role);
    }
    expect(s).toBe('RELEASED');
  });

  it('角色越权抛错：QA 不能合入；DEV 不能触发构建', () => {
    expect(() => assertCrTransition('AWAITING_MERGE', 'merge', 'QA')).toThrow(/无权/);
    expect(() => assertCrTransition('APPROVED', 'start-build', 'DEV')).toThrow(/无权/);
  });

  it('起点不符抛错：GATE_CHECK 直接合入非法（须先 gate-pass）', () => {
    expect(() => assertCrTransition('GATE_CHECK', 'merge', 'ADMIN')).toThrow(/不能执行/);
  });

  it('废弃：任意非终态均可废弃', () => {
    for (const s of ['DRAFT', 'IN_REVIEW', 'BUILDING', 'MERGED'] as CrStatusString[]) {
      expect(assertCrTransition(s, 'abandon', 'DEV')).toBe('ABANDONED');
    }
  });
});

describe('availableCrActions 按钮显隐', () => {
  it('QA 在 REGRESSION 态见「回归完成/废弃」，在 DRAFT 态见「废弃」但无「提交评审」', () => {
    expect(availableCrActions('REGRESSION', 'QA')).toEqual(['regression-done', 'abandon']);
    const draftQa = availableCrActions('DRAFT', 'QA');
    expect(draftQa).toContain('abandon');
    expect(draftQa).not.toContain('submit');
  });

  it('ADMIN 在 AWAITING_MERGE 态见「合入/废弃」', () => {
    expect(availableCrActions('AWAITING_MERGE', 'ADMIN')).toEqual(['merge', 'abandon']);
  });

  it('终态无任何可执行动作', () => {
    expect(availableCrActions('RELEASED', 'ADMIN')).toEqual([]);
    expect(availableCrActions('ABANDONED', 'DEV')).toEqual([]);
  });
});
