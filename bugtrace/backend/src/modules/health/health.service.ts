import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 健康检查：服务本身恒为 ok；数据库连通性实时探测，
   * 数据库断开时 db='down'（HTTP 仍返回 200，供容器 healthcheck / 监控消费）。
   */
  async check(): Promise<{ status: string; db: string }> {
    let db: string = 'down';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      db = 'up';
    } catch {
      db = 'down';
    }
    return { status: 'ok', db };
  }
}
