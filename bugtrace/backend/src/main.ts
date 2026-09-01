import 'dotenv/config'; // 加载 backend/.env（DATABASE_URL / JWT_SECRET）
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { resolve } from 'path';
import { AppModule } from './app.module';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

// Prisma BigInt 主键序列化为字符串（JSON.stringify 原生不支持 BigInt）
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(BigInt.prototype as any).toJSON = function (this: bigint): string {
  return this.toString();
};

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // T3-3 · 静态直出：/uploads/** → backend/uploads/**（<img> 预览，见白名单 auth-whitelist.ts）
  app.useStaticAssets(resolve(process.cwd(), 'uploads'), {
    prefix: '/uploads/',
  });

  // DTO 校验（class-validator）：缺必填字段 → 400，消息走统一异常过滤器
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true, // 按 DTO 类型转换（字符串 id → BigInt 等）
      whitelist: true, // 剥离 DTO 未声明的多余字段
    }),
  );

  // 跨域：前后端分离开发（Vite dev server 与后端不同源）
  app.enableCors();

  // 统一响应格式 { code, message, data }
  app.useGlobalInterceptors(new TransformInterceptor());

  // 全局异常过滤器：HttpException → { code, message, data: null }
  app.useGlobalFilters(new AllExceptionsFilter());

  // Swagger 文档：/docs
  const config = new DocumentBuilder()
    .setTitle('BugTrace API')
    .setDescription('BugTrace MVP 后端接口文档')
    .setVersion('0.1.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('/docs', app, document);

  // 端口约定：3000（与 docker-compose APP_PORT 一致，.env 由后续任务接线）
  await app.listen(3000);
  // eslint-disable-next-line no-console
  console.log('BugTrace API listening on http://localhost:3000');
}

void bootstrap();
