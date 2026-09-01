// BugTrace MVP · 种子数据入口（T0-3 骨架）
// 说明：
//  - 本文件为 seed 框架，当前只有「清空重建」骨架，无业务数据；
//  - T1-1 将在此填充 3 个角色账号（admin/dev/qa）；
//  - 运行方式：npm run seed（= prisma db seed = ts-node prisma/seed.ts）。
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  // —— 清空重建（保持幂等：先删业务数据，再插入种子）——
  // 注意删除顺序：先子表后父表（外键约束）
  // T0-3 阶段无数据表内容，仅预留结构；
  // T1-1 起在此逐表填充种子数据。

  // 示例（T1-1 启用）：
  // await prisma.bugLog.deleteMany();
  // await prisma.attachment.deleteMany();
  // await prisma.bug.deleteMany();
  // await prisma.testPlan.deleteMany();
  // await prisma.testCase.deleteMany();
  // await prisma.requirement.deleteMany();
  // await prisma.project.deleteMany();
  // await prisma.user.deleteMany();

  console.log('[seed] 骨架就绪：暂无种子数据（等待 T1-1 填充）');
}

main()
  .catch((e) => {
    console.error('[seed] 执行失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
