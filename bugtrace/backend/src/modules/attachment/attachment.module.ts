import { Module } from '@nestjs/common';
import { AttachmentController } from './attachment.controller';
import { AttachmentService } from './attachment.service';

/**
 * T3-3 · attachment 模块：上传（multipart ≤5MB png/jpg/jpeg）+ 下载（stream）
 * + 本地 uploads 存储（静态直出见 main.ts，Docker 卷挂载见 docker-compose.yml）
 */
@Module({
  controllers: [AttachmentController],
  providers: [AttachmentService],
})
export class AttachmentModule {}
