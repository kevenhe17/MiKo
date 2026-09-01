// T4-1 · 演示数据种子脚本：一键灌入与 14 步分镜脚本匹配的演示数据（幂等可重跑）
// 运行方式：npm run seed:demo
//
// 数据规模（与任务卡 Constraints 对齐）：
//   1 项目（DEMO）+ admin/dev/qa 三成员 + 1 需求 + 3 用例 + 1 测试计划
//   + 7 条 Bug：覆盖 6 个状态各至少 1 条，其中 1 条为「回归失败重开」态
//   （BUG-DEMO-0007：FIXED → verify(false) → IN_PROGRESS，流水含两条留痕）
//   + 6 条变更单（T5-5）：覆盖 10 态中的 9 态 + 1 条待回流 HOTFIX，
//     流水时间戳分散在近 14 天，支撑趋势图与状态分布环图演示
//
// 幂等方式：执行前清空业务表（change_log → change_request → bug_log →
// attachment → bug → test_plan → test_case → requirement → project）
// 再全量重建，不触碰 user 表。
//
// 已记录假设：
//   1. 本地无示例图片资产，故不预置 attachment 记录；截图上传链路在 T4-2
//      联调走查时按分镜第 7 步（提单带图）手动验证。
//   2. 依赖 npm run seed 已写入 admin/dev/qa 账号；脚本启动时校验，
//      缺失即报错并提示先执行 npm run seed。
//   3. bug_log.action 取值与 BugService.transition 的写入保持一致
//      （assign/start/fix/verify/close/reopen/reject）；回归失败路径
//      追加的额外 reopen 流水与 BugService.verify(passed=false) 行为一致。
//   4. change_log.action 与 ChangeService 写入一致（create/submit/approve/
//      reject-review/start-build/build-done/regression-done/gate-pass/merge/
//      release/abandon/backflow-done）；reviewer 字段在 approve 流水时同步落库。
import { PrismaClient, BugSeverity, BugStatus, ChangeStatus } from '@prisma/client';

const prisma = new PrismaClient();

/** 相对当前时间偏移（小时），让流水时间轴符合真实操作节奏 */
function hoursAgo(h: number): Date {
  return new Date(Date.now() - h * 3600 * 1000);
}

/** 单条 Bug 的完整定义：主表字段 + 按时间顺序的流转流水 */
interface BugSeed {
  code: string;
  title: string;
  severity: BugSeverity;
  priority: string;
  status: BugStatus;
  module: string;
  environment: string;
  steps: string;
  expected: string;
  actual: string;
  ownerId?: bigint;   // ASSIGNED 起分派给 dev
  fixerId?: bigint;   // start 后自动置为 dev
  rootCause?: string;
  fixDesc?: string;
  impact?: string;
  requirementId?: bigint;
  caseId?: bigint;
  createdAt: Date;
  /** 流水：op = 操作人 username，action 与后端写入一致 */
  logs: Array<{
    op: 'admin' | 'dev' | 'qa';
    action: 'assign' | 'start' | 'fix' | 'verify' | 'close' | 'reopen' | 'reject';
    from: BugStatus;
    to: BugStatus;
    comment?: string;
    at: Date;
  }>;
}

async function main(): Promise<void> {
  // —— 0. 校验三账号就绪（不修改用户表） ——
  const users = await prisma.user.findMany({
    where: { username: { in: ['admin', 'dev', 'qa'] } },
  });
  const byName = new Map(users.map((u) => [u.username, u]));
  const admin = byName.get('admin');
  const dev = byName.get('dev');
  const qa = byName.get('qa');
  if (!admin || !dev || !qa) {
    throw new Error('缺少 admin / dev / qa 账号，请先执行：npm run seed');
  }

  // —— 1. 幂等清场：按外键依赖顺序删除业务表（不动 user） ——
  await prisma.changeLog.deleteMany();
  await prisma.changeRequest.deleteMany();
  await prisma.bugLog.deleteMany();
  await prisma.attachment.deleteMany();
  await prisma.bug.deleteMany();
  await prisma.testPlan.deleteMany();
  await prisma.testCase.deleteMany();
  await prisma.requirement.deleteMany();
  await prisma.project.deleteMany();

  // —— 2. 项目：DEMO（三成员，members JSON 与 ProjectService 格式一致：userId 字符串） ——
  const project = await prisma.project.create({
    data: {
      code: 'DEMO',
      name: '演示项目',
      description: 'BugTrace MVP 演示数据：支撑 14 步分镜走查的完整数据集',
      createdBy: admin.id,
      members: [
        { userId: String(admin.id), role: 'ADMIN' },
        { userId: String(dev.id), role: 'DEV' },
        { userId: String(qa.id), role: 'QA' },
      ],
      createdAt: hoursAgo(7 * 24),
    },
  });

  // —— 3. 需求 1 条 ——
  const requirement = await prisma.requirement.create({
    data: {
      projectId: project.id,
      code: 'REQ-DEMO-0001',
      title: '登录模块支持账号密码登录',
      description: '用户可使用用户名 + 密码登录系统；连续 5 次失败锁定 10 分钟。',
      status: 'OPEN',
      createdAt: hoursAgo(6 * 24),
    },
  });

  // —— 4. 用例 3 条（挂在需求上，形成「需求 → 用例」追溯链） ——
  const caseIds: bigint[] = [];
  const CASE_SEEDS = [
    {
      module: '登录', title: '正确账号密码可成功登录', priority: 'P0',
      precond: '账号已存在且未锁定',
      steps: '1. 打开登录页\n2. 输入正确用户名\n3. 输入正确密码\n4. 点击「登录」',
      expected: '登录成功，跳转项目列表页', at: hoursAgo(5 * 24 + 6),
    },
    {
      module: '登录', title: '连续 5 次错误密码后账号锁定', priority: 'P1',
      precond: '账号存在且未锁定',
      steps: '1. 打开登录页\n2. 连续 5 次输入错误密码登录',
      expected: '第 5 次失败后提示「账号已锁定 10 分钟」',
      at: hoursAgo(5 * 24 + 4),
    },
    {
      module: '搜索', title: '搜索关键字为空时展示全部', priority: 'P2',
      precond: 'Bug 列表有数据',
      steps: '1. 进入 Bug 列表页\n2. 清空搜索关键字\n3. 点击「查询」',
      expected: '列表展示全部 Bug，分页正确',
      at: hoursAgo(5 * 24 + 2),
    },
  ];
  for (const c of CASE_SEEDS) {
    const created = await prisma.testCase.create({
      data: {
        projectId: project.id,
        module: c.module,
        title: c.title,
        precond: c.precond,
        steps: c.steps,
        expected: c.expected,
        priority: c.priority,
        requirementId: requirement.id,
        createdAt: c.at,
      },
    });
    caseIds.push(created.id);
  }

  // —— 5. 测试计划 1 条（owner = qa） ——
  await prisma.testPlan.create({
    data: {
      projectId: project.id,
      name: '登录模块第一轮冒烟测试',
      ownerId: qa.id,
      caseIds: caseIds.map((id) => String(id)),
      status: 'READY',
      createdAt: hoursAgo(5 * 24),
    },
  });

  // —— 6. Bug 7 条：6 状态全覆盖 + 1 条回归失败重开态 ——
  const BUG_SEEDS: BugSeed[] = [
    {
      // ① NEW：待分派（演示「分派」动作入口）
      code: 'BUG-DEMO-0001', title: '勾选「记住密码」后下次登录未回填',
      severity: BugSeverity.MINOR, priority: 'P2', status: BugStatus.NEW,
      module: '登录', environment: 'Chrome 126 / Win11',
      steps: '1. 登录页勾选「记住密码」\n2. 登录成功后退出\n3. 重新打开登录页',
      expected: '用户名与密码自动回填', actual: '用户名回填，密码为空',
      createdAt: hoursAgo(10), logs: [],
    },
    {
      // ② ASSIGNED：已分派待开发（演示「开始处理」入口）
      code: 'BUG-DEMO-0002', title: '用户名含特殊字符时登录接口返回 500',
      severity: BugSeverity.CRITICAL, priority: 'P1', status: BugStatus.ASSIGNED,
      module: '登录', environment: 'Chrome 126 / Win11',
      steps: '1. 登录页输入用户名 a<b>c\n2. 输入任意密码\n3. 点击「登录」',
      expected: '提示「账号或密码错误」', actual: '页面报 500，接口未捕获非法输入',
      ownerId: dev.id,
      createdAt: hoursAgo(26),
      logs: [
        { op: 'qa', action: 'assign', from: BugStatus.NEW, to: BugStatus.ASSIGNED, comment: '前端可复现，优先排查参数校验', at: hoursAgo(25) },
      ],
    },
    {
      // ③ IN_PROGRESS：处理中（挂需求 + 用例，展示追溯链）
      code: 'BUG-DEMO-0003', title: '连续 5 次登录失败后账号未锁定',
      severity: BugSeverity.MAJOR, priority: 'P1', status: BugStatus.IN_PROGRESS,
      module: '登录', environment: 'Chrome 126 / macOS 14',
      steps: '1. 打开登录页\n2. 连续 5 次输入错误密码登录',
      expected: '第 5 次失败后提示「账号已锁定 10 分钟」', actual: '始终提示「账号或密码错误」，可继续尝试',
      ownerId: dev.id, fixerId: dev.id,
      requirementId: requirement.id, caseId: caseIds[1],
      createdAt: hoursAgo(3 * 24),
      logs: [
        { op: 'qa', action: 'assign', from: BugStatus.NEW, to: BugStatus.ASSIGNED, comment: '需求 REQ-DEMO-0001 明确要求锁定策略', at: hoursAgo(3 * 24 - 1) },
        { op: 'dev', action: 'start', from: BugStatus.ASSIGNED, to: BugStatus.IN_PROGRESS, at: hoursAgo(2 * 24) },
      ],
    },
    {
      // ④ FIXED：待回归（演示「回归验证」入口）
      code: 'BUG-DEMO-0004', title: '验证码 60 秒倒计时结束后按钮不可点击',
      severity: BugSeverity.MAJOR, priority: 'P1', status: BugStatus.FIXED,
      module: '登录', environment: 'Chrome 126 / Win11',
      steps: '1. 登录页点击「获取验证码」\n2. 等待 60 秒倒计时结束',
      expected: '倒计时结束后按钮恢复可点击', actual: '按钮停留在禁用态，需刷新页面',
      ownerId: dev.id, fixerId: dev.id,
      rootCause: '倒计时结束只清了文本，未移除 disabled 属性',
      fixDesc: '倒计时结束时同步重置按钮 disabled 状态',
      impact: '仅影响登录页验证码按钮，无其他调用方',
      createdAt: hoursAgo(4 * 24),
      logs: [
        { op: 'qa', action: 'assign', from: BugStatus.NEW, to: BugStatus.ASSIGNED, comment: '注册页同款按钮正常，登录页单独排查', at: hoursAgo(4 * 24 - 1) },
        { op: 'dev', action: 'start', from: BugStatus.ASSIGNED, to: BugStatus.IN_PROGRESS, at: hoursAgo(4 * 24 - 8) },
        { op: 'dev', action: 'fix', from: BugStatus.IN_PROGRESS, to: BugStatus.FIXED, comment: '修复说明：倒计时结束时同步重置按钮 disabled 状态', at: hoursAgo(4 * 24 - 16) },
      ],
    },
    {
      // ⑤ VERIFIED：已验证待关闭（演示「关闭」入口）
      code: 'BUG-DEMO-0005', title: '登录失败时密码明文输出到前端控制台日志',
      severity: BugSeverity.CRITICAL, priority: 'P0', status: BugStatus.VERIFIED,
      module: '登录', environment: 'Chrome 126 / Win11',
      steps: '1. 打开浏览器控制台\n2. 用错误密码登录一次',
      expected: '控制台无任何密码明文', actual: '控制台打印完整密码明文',
      ownerId: dev.id, fixerId: dev.id,
      rootCause: '调试遗留 console.log 未删除',
      fixDesc: '删除登录失败分支的 console.log，统一走日志组件脱敏输出',
      impact: '登录模块日志输出，不影响其他功能',
      createdAt: hoursAgo(5 * 24 + 10),
      logs: [
        { op: 'qa', action: 'assign', from: BugStatus.NEW, to: BugStatus.ASSIGNED, comment: '安全隐患，P0 优先处理', at: hoursAgo(5 * 24 + 9) },
        { op: 'dev', action: 'start', from: BugStatus.ASSIGNED, to: BugStatus.IN_PROGRESS, at: hoursAgo(5 * 24 + 6) },
        { op: 'dev', action: 'fix', from: BugStatus.IN_PROGRESS, to: BugStatus.FIXED, comment: '修复说明：删除登录失败分支的 console.log，统一走日志组件脱敏输出', at: hoursAgo(5 * 24 + 2) },
        { op: 'qa', action: 'verify', from: BugStatus.FIXED, to: BugStatus.VERIFIED, comment: '回归验证通过', at: hoursAgo(5 * 24) },
      ],
    },
    {
      // ⑥ CLOSED：全链路闭环（assign→start→fix→verify→close）
      code: 'BUG-DEMO-0006', title: '移动端登录页输入框被软键盘遮挡',
      severity: BugSeverity.MINOR, priority: 'P2', status: BugStatus.CLOSED,
      module: '登录', environment: 'Safari / iOS 17',
      steps: '1. 移动端打开登录页\n2. 聚焦密码输入框',
      expected: '页面自动上移，输入框完整可见', actual: '输入框被软键盘遮挡约一半',
      ownerId: dev.id, fixerId: dev.id,
      rootCause: '未使用视觉视口高度（dvh）布局',
      fixDesc: '登录容器高度改为 100dvh 并监听软键盘弹出滚动',
      impact: '仅移动端登录页布局',
      createdAt: hoursAgo(6 * 24 + 12),
      logs: [
        { op: 'qa', action: 'assign', from: BugStatus.NEW, to: BugStatus.ASSIGNED, comment: 'iOS 主测机型必现', at: hoursAgo(6 * 24 + 10) },
        { op: 'dev', action: 'start', from: BugStatus.ASSIGNED, to: BugStatus.IN_PROGRESS, at: hoursAgo(6 * 24 + 6) },
        { op: 'dev', action: 'fix', from: BugStatus.IN_PROGRESS, to: BugStatus.FIXED, comment: '修复说明：登录容器高度改为 100dvh 并监听软键盘弹出滚动', at: hoursAgo(6 * 24) },
        { op: 'qa', action: 'verify', from: BugStatus.FIXED, to: BugStatus.VERIFIED, comment: '回归验证通过', at: hoursAgo(5 * 24 + 18) },
        { op: 'qa', action: 'close', from: BugStatus.VERIFIED, to: BugStatus.CLOSED, comment: '验证通过，关闭缺陷', at: hoursAgo(5 * 24 + 12) },
      ],
    },
    {
      // ⑦ 回归失败重开态：IN_PROGRESS，流水含 FIXED→IN_PROGRESS 双留痕
      code: 'BUG-DEMO-0007', title: '找回密码邮件中的重置链接 1 小时后仍可使用',
      severity: BugSeverity.MAJOR, priority: 'P1', status: BugStatus.IN_PROGRESS,
      module: '登录', environment: 'Chrome 126 / Win11',
      steps: '1. 触发找回密码\n2. 等待链接过期时间（1 小时）\n3. 点击邮件中的重置链接',
      expected: '提示「链接已过期，请重新申请」', actual: '链接过期后仍可正常重置密码',
      ownerId: dev.id, fixerId: dev.id,
      rootCause: '过期校验用的是创建时间而非过期时间字段',
      fixDesc: '改为按 expiresAt 字段校验，过期即拒绝',
      impact: '找回密码链路，需同步清理历史未过期令牌',
      createdAt: hoursAgo(2 * 24 + 12),
      logs: [
        { op: 'qa', action: 'assign', from: BugStatus.NEW, to: BugStatus.ASSIGNED, comment: '过期时间应为 1 小时，实测 2 小时后仍有效', at: hoursAgo(2 * 24 + 10) },
        { op: 'dev', action: 'start', from: BugStatus.ASSIGNED, to: BugStatus.IN_PROGRESS, at: hoursAgo(2 * 24 + 6) },
        { op: 'dev', action: 'fix', from: BugStatus.IN_PROGRESS, to: BugStatus.FIXED, comment: '修复说明：改为按 expiresAt 字段校验，过期即拒绝', at: hoursAgo(2 * 24) },
        { op: 'qa', action: 'verify', from: BugStatus.FIXED, to: BugStatus.IN_PROGRESS, comment: '回归失败：随机等待时长后再次复现，偶发', at: hoursAgo(30) },
        { op: 'qa', action: 'reopen', from: BugStatus.FIXED, to: BugStatus.IN_PROGRESS, comment: '回归失败，自动重开（reopen）', at: hoursAgo(30) },
      ],
    },
  ];

  const operatorIds: Record<'admin' | 'dev' | 'qa', bigint> = {
    admin: admin.id, dev: dev.id, qa: qa.id,
  };

  for (const b of BUG_SEEDS) {
    const bug = await prisma.bug.create({
      data: {
        projectId: project.id,
        code: b.code,
        title: b.title,
        severity: b.severity,
        priority: b.priority,
        status: b.status,
        module: b.module,
        environment: b.environment,
        steps: b.steps,
        expected: b.expected,
        actual: b.actual,
        ownerId: b.ownerId ?? null,
        fixerId: b.fixerId ?? null,
        rootCause: b.rootCause ?? null,
        fixDesc: b.fixDesc ?? null,
        impact: b.impact ?? null,
        requirementId: b.requirementId ?? null,
        caseId: b.caseId ?? null,
        createdAt: b.createdAt,
      },
    });
    for (const log of b.logs) {
      await prisma.bugLog.create({
        data: {
          bugId: bug.id,
          operatorId: operatorIds[log.op],
          action: log.action,
          fromStatus: log.from,
          toStatus: log.to,
          comment: log.comment ?? null,
          createdAt: log.at,
        },
      });
    }
  }

  // —— 7. 变更单 6 条（T5-5）：覆盖 9 态 + 1 待回流，流水分散近 14 天 ——
  // 与 ChangeService 字段落库口径一致：approve 时写 reviewer、merge 时写
  // mergedBy/mergedAt/mergedSha、release 时写 tag；HOTFIX 强制 backflow=PENDING。
  interface CrSeed {
    code: string;
    title: string;
    type: 'FEATURE' | 'BUGFIX' | 'HOTFIX' | 'CONFIG' | 'DEPENDENCY' | 'ROLLBACK';
    sourceType: 'BUG' | 'REQUIREMENT' | 'INCIDENT' | 'TECH';
    sourceId?: bigint;
    srcBranch: string;
    dstBranch: string;
    riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
    status: ChangeStatus;
    ownerId: bigint;
    reviewerId?: bigint;
    mergedById?: bigint;
    mergedAt?: Date;
    mergedSha?: string;
    tag?: string;
    backflowStatus?: 'PENDING' | 'DONE';
    createdAt: Date;
    logs: Array<{
      op: 'admin' | 'dev' | 'qa';
      action: string;
      from: ChangeStatus;
      to: ChangeStatus;
      comment?: string;
      at: Date;
    }>;
  }

  const CR_SEEDS: CrSeed[] = [
    {
      // ① 已发布全链路（create→submit→approve→start-build→build-done→
      //    regression-done→gate-pass→merge→release），13 天前闭环
      code: 'CR-DEMO-0001',
      title: '【功能】登录模块账号密码登录支持',
      type: 'FEATURE', sourceType: 'REQUIREMENT', sourceId: requirement.id,
      srcBranch: 'feature/REQ-DEMO-0001-login', dstBranch: 'main',
      riskLevel: 'MEDIUM', status: ChangeStatus.RELEASED,
      ownerId: dev.id, reviewerId: admin.id,
      mergedById: admin.id, mergedAt: hoursAgo(13 * 24), mergedSha: 'a1b2c3d',
      tag: 'v1.0.0',
      createdAt: hoursAgo(14 * 24),
      logs: [
        { op: 'dev', action: 'create', from: ChangeStatus.DRAFT, to: ChangeStatus.DRAFT, comment: '创建变更单（草稿）', at: hoursAgo(14 * 24) },
        { op: 'dev', action: 'submit', from: ChangeStatus.DRAFT, to: ChangeStatus.IN_REVIEW, at: hoursAgo(13.8 * 24) },
        { op: 'admin', action: 'approve', from: ChangeStatus.IN_REVIEW, to: ChangeStatus.APPROVED, comment: '方案可行，按需求实现', at: hoursAgo(13.6 * 24) },
        { op: 'admin', action: 'start-build', from: ChangeStatus.APPROVED, to: ChangeStatus.BUILDING, comment: '触发 CI 构建', at: hoursAgo(13.5 * 24) },
        { op: 'admin', action: 'build-done', from: ChangeStatus.BUILDING, to: ChangeStatus.REGRESSION, comment: '构建成功，进入回归', at: hoursAgo(13.4 * 24) },
        { op: 'qa', action: 'regression-done', from: ChangeStatus.REGRESSION, to: ChangeStatus.GATE_CHECK, comment: '冒烟用例 3/3 通过', at: hoursAgo(13.2 * 24) },
        { op: 'admin', action: 'gate-pass', from: ChangeStatus.GATE_CHECK, to: ChangeStatus.AWAITING_MERGE, comment: '门禁校验全部通过', at: hoursAgo(13.1 * 24) },
        { op: 'admin', action: 'merge', from: ChangeStatus.AWAITING_MERGE, to: ChangeStatus.MERGED, comment: '已合入目标分支（a1b2c3d）', at: hoursAgo(13 * 24) },
        { op: 'admin', action: 'release', from: ChangeStatus.MERGED, to: ChangeStatus.RELEASED, comment: '发布完成，Tag：v1.0.0', at: hoursAgo(12.8 * 24) },
      ],
    },
    {
      // ② 待评审（演示 submit/approve 入口）
      code: 'CR-DEMO-0002',
      title: '【缺陷修复】记住密码回填异常修正',
      type: 'BUGFIX', sourceType: 'BUG',
      srcBranch: 'bugfix/BUG-DEMO-0001-remember', dstBranch: 'main',
      riskLevel: 'LOW', status: ChangeStatus.IN_REVIEW,
      ownerId: dev.id, reviewerId: admin.id,
      createdAt: hoursAgo(20),
      logs: [
        { op: 'dev', action: 'create', from: ChangeStatus.DRAFT, to: ChangeStatus.DRAFT, comment: '创建变更单（草稿）', at: hoursAgo(20) },
        { op: 'dev', action: 'submit', from: ChangeStatus.DRAFT, to: ChangeStatus.IN_REVIEW, at: hoursAgo(18) },
      ],
    },
    {
      // ③ 待回归（演示 regression-done 入口，QA 视角）
      code: 'CR-DEMO-0003',
      title: '【缺陷修复】验证码按钮倒计时禁用修正',
      type: 'BUGFIX', sourceType: 'BUG',
      srcBranch: 'bugfix/BUG-DEMO-0004-captcha', dstBranch: 'main',
      riskLevel: 'MEDIUM', status: ChangeStatus.REGRESSION,
      ownerId: dev.id, reviewerId: admin.id,
      createdAt: hoursAgo(2 * 24),
      logs: [
        { op: 'dev', action: 'create', from: ChangeStatus.DRAFT, to: ChangeStatus.DRAFT, comment: '创建变更单（草稿）', at: hoursAgo(2 * 24) },
        { op: 'dev', action: 'submit', from: ChangeStatus.DRAFT, to: ChangeStatus.IN_REVIEW, at: hoursAgo(46) },
        { op: 'admin', action: 'approve', from: ChangeStatus.IN_REVIEW, to: ChangeStatus.APPROVED, comment: '根因清晰，同意合入', at: hoursAgo(44) },
        { op: 'admin', action: 'start-build', from: ChangeStatus.APPROVED, to: ChangeStatus.BUILDING, comment: '触发 CI 构建', at: hoursAgo(42) },
        { op: 'admin', action: 'build-done', from: ChangeStatus.BUILDING, to: ChangeStatus.REGRESSION, comment: '构建成功，进入回归', at: hoursAgo(40) },
      ],
    },
    {
      // ④ 已合入待发布（演示 release 入口）
      code: 'CR-DEMO-0004',
      title: '【缺陷修复】登录失败日志脱敏修正',
      type: 'BUGFIX', sourceType: 'BUG',
      srcBranch: 'bugfix/BUG-DEMO-0005-log', dstBranch: 'main',
      riskLevel: 'HIGH', status: ChangeStatus.MERGED,
      ownerId: dev.id, reviewerId: admin.id,
      mergedById: admin.id, mergedAt: hoursAgo(30), mergedSha: 'e4f5a6b',
      createdAt: hoursAgo(4 * 24),
      logs: [
        { op: 'dev', action: 'create', from: ChangeStatus.DRAFT, to: ChangeStatus.DRAFT, comment: '创建变更单（草稿）', at: hoursAgo(4 * 24) },
        { op: 'dev', action: 'submit', from: ChangeStatus.DRAFT, to: ChangeStatus.IN_REVIEW, at: hoursAgo(94) },
        { op: 'admin', action: 'approve', from: ChangeStatus.IN_REVIEW, to: ChangeStatus.APPROVED, comment: '安全问题优先走紧急通道', at: hoursAgo(92) },
        { op: 'admin', action: 'start-build', from: ChangeStatus.APPROVED, to: ChangeStatus.BUILDING, comment: '触发 CI 构建', at: hoursAgo(90) },
        { op: 'admin', action: 'build-done', from: ChangeStatus.BUILDING, to: ChangeStatus.REGRESSION, comment: '构建成功，进入回归', at: hoursAgo(88) },
        { op: 'qa', action: 'regression-done', from: ChangeStatus.REGRESSION, to: ChangeStatus.GATE_CHECK, comment: '回归通过', at: hoursAgo(86) },
        { op: 'admin', action: 'gate-pass', from: ChangeStatus.GATE_CHECK, to: ChangeStatus.AWAITING_MERGE, comment: '门禁校验全部通过', at: hoursAgo(84) },
        { op: 'admin', action: 'merge', from: ChangeStatus.AWAITING_MERGE, to: ChangeStatus.MERGED, comment: '已合入目标分支（e4f5a6b）', at: hoursAgo(30) },
      ],
    },
    {
      // ⑤ HOTFIX 待回流（演示 backflow-done 入口与待回流清单）
      code: 'CR-DEMO-0005',
      title: '【热修复】找回密码重置链接过期校验紧急修正',
      type: 'HOTFIX', sourceType: 'BUG',
      srcBranch: 'hotfix/BUG-DEMO-0007-token', dstBranch: 'release/v1.0',
      riskLevel: 'HIGH', status: ChangeStatus.RELEASED,
      ownerId: dev.id, reviewerId: admin.id,
      mergedById: admin.id, mergedAt: hoursAgo(60), mergedSha: 'c7d8e9f',
      tag: 'v1.0.1', backflowStatus: 'PENDING',
      createdAt: hoursAgo(4 * 24 + 12),
      logs: [
        { op: 'dev', action: 'create', from: ChangeStatus.DRAFT, to: ChangeStatus.DRAFT, comment: '创建变更单（草稿）', at: hoursAgo(4 * 24 + 12) },
        { op: 'dev', action: 'submit', from: ChangeStatus.DRAFT, to: ChangeStatus.IN_REVIEW, at: hoursAgo(4 * 24 + 10) },
        { op: 'admin', action: 'approve', from: ChangeStatus.IN_REVIEW, to: ChangeStatus.APPROVED, comment: '线上问题，紧急合入', at: hoursAgo(4 * 24 + 8) },
        { op: 'admin', action: 'start-build', from: ChangeStatus.APPROVED, to: ChangeStatus.BUILDING, comment: '触发 CI 构建', at: hoursAgo(4 * 24 + 7) },
        { op: 'admin', action: 'build-done', from: ChangeStatus.BUILDING, to: ChangeStatus.REGRESSION, comment: '构建成功，进入回归', at: hoursAgo(4 * 24 + 6) },
        { op: 'qa', action: 'regression-done', from: ChangeStatus.REGRESSION, to: ChangeStatus.GATE_CHECK, comment: '重点回归找回密码链路，通过', at: hoursAgo(4 * 24 + 4) },
        { op: 'admin', action: 'gate-pass', from: ChangeStatus.GATE_CHECK, to: ChangeStatus.AWAITING_MERGE, comment: '门禁校验全部通过', at: hoursAgo(4 * 24 + 2) },
        { op: 'admin', action: 'merge', from: ChangeStatus.AWAITING_MERGE, to: ChangeStatus.MERGED, comment: '已合入目标分支（c7d8e9f）', at: hoursAgo(60) },
        { op: 'admin', action: 'release', from: ChangeStatus.MERGED, to: ChangeStatus.RELEASED, comment: '发布完成，Tag：v1.0.1', at: hoursAgo(58) },
      ],
    },
    {
      // ⑥ 已废弃（演示 abandon 与 reject-review 双分支）
      code: 'CR-DEMO-0006',
      title: '【依赖升级】登录 SDK 大版本升级评估',
      type: 'DEPENDENCY', sourceType: 'TECH',
      srcBranch: 'chore/sdk-upgrade', dstBranch: 'main',
      riskLevel: 'HIGH', status: ChangeStatus.ABANDONED,
      ownerId: dev.id,
      createdAt: hoursAgo(8 * 24),
      logs: [
        { op: 'dev', action: 'create', from: ChangeStatus.DRAFT, to: ChangeStatus.DRAFT, comment: '创建变更单（草稿）', at: hoursAgo(8 * 24) },
        { op: 'dev', action: 'submit', from: ChangeStatus.DRAFT, to: ChangeStatus.IN_REVIEW, at: hoursAgo(7.8 * 24) },
        { op: 'admin', action: 'reject-review', from: ChangeStatus.IN_REVIEW, to: ChangeStatus.DRAFT, comment: '不兼容 API 过多，本期不升级', at: hoursAgo(7.6 * 24) },
        { op: 'dev', action: 'abandon', from: ChangeStatus.DRAFT, to: ChangeStatus.ABANDONED, comment: '按评审结论搁置，下季度再评估', at: hoursAgo(7 * 24) },
      ],
    },
  ];

  for (const cr of CR_SEEDS) {
    const created = await prisma.changeRequest.create({
      data: {
        projectId: project.id,
        code: cr.code,
        title: cr.title,
        type: cr.type,
        sourceType: cr.sourceType,
        sourceId: cr.sourceId ?? null,
        srcBranch: cr.srcBranch,
        dstBranch: cr.dstBranch,
        riskLevel: cr.riskLevel,
        needRegression: true,
        status: cr.status,
        ownerId: cr.ownerId,
        reviewerId: cr.reviewerId ?? null,
        mergedBy: cr.mergedById ?? null,
        mergedAt: cr.mergedAt ?? null,
        mergedSha: cr.mergedSha ?? null,
        tag: cr.tag ?? null,
        backflowStatus: cr.backflowStatus ?? null,
        createdAt: cr.createdAt,
      },
    });
    for (const log of cr.logs) {
      await prisma.changeLog.create({
        data: {
          crId: created.id,
          operatorId: operatorIds[log.op],
          action: log.action,
          fromStatus: log.from,
          toStatus: log.to,
          comment: log.comment ?? null,
          createdAt: log.at,
        },
      });
    }
  }

  // —— 8. 汇总输出（便于核对验收标准「各表数据量」） ——
  const [p, req, tc, tp, bg, logs, cr, crLogs] = await Promise.all([
    prisma.project.count(),
    prisma.requirement.count(),
    prisma.testCase.count(),
    prisma.testPlan.count(),
    prisma.bug.count(),
    prisma.bugLog.count(),
    prisma.changeRequest.count(),
    prisma.changeLog.count(),
  ]);
  console.log('[demo-seed] 完成：');
  console.log(`  项目 ${p}（DEMO）· 需求 ${req} · 用例 ${tc} · 计划 ${tp} · Bug ${bg} · 流水 ${logs}`);
  console.log(`  变更单 ${cr} · 变更流水 ${crLogs}`);
  console.log('  Bug 状态分布：NEW×1 ASSIGNED×1 IN_PROGRESS×2（含回归失败重开×1）FIXED×1 VERIFIED×1 CLOSED×1');
  console.log('  CR 状态分布：RELEASED×2（含待回流 HOTFIX×1）IN_REVIEW×1 REGRESSION×1 MERGED×1 ABANDONED×1');
  console.log('  DEV 账号可见 Bug（owner/fixer 为自己）：6 条');
}

main()
  .catch((e) => {
    console.error('[demo-seed] 执行失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
