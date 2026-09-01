import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Prisma 全局服务（PrismaModule 为 @Global，业务模块无需重复注入）。
 * 数据库不可用时服务仍可启动（onModuleInit 只记录警告），
 * 由 /health 健康检查暴露 db 状态。
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
      this.logger.log('Database connected');
    } catch (e) {
      this.logger.warn(
        `Database unavailable at startup: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }
}
