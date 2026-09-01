import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

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
