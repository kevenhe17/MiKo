import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { HealthService } from './health.service';

@ApiTags('系统')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({ summary: '健康检查（含数据库连通性）' })
  health(): Promise<{ status: string; db: string }> {
    return this.healthService.check();
  }
}
