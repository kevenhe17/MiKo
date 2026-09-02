// T1-1 · 种子数据：admin / dev / qa 三个角色账号（幂等 upsert）
// 运行方式：npm run seed
import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const ACCOUNTS: Array<{ username: string; realname: string; role: Role }> = [
  { username: 'admin', realname: '系统管理员', role: Role.ADMIN },
  { username: 'dev', realname: '开发同学', role: Role.DEV },
  { username: 'qa', realname: '测试同学', role: Role.QA },
];

const INITIAL_PASSWORD = '123456';

async function main(): Promise<void> {
  const passwordHash = await bcrypt.hash(INITIAL_PASSWORD, 10);

  for (const account of ACCOUNTS) {
    await prisma.user.upsert({
      where: { username: account.username },
      update: { passwordHash, realname: account.realname, role: account.role },
      create: { ...account, passwordHash },
    });
  }

  console.log('[seed] 已就绪账号：admin / dev / qa（初始密码 123456）');
}

main()
  .catch((e) => {
    console.error('[seed] 执行失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
