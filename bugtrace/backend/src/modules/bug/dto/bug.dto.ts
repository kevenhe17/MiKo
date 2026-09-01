import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateBugDto {
  @ApiProperty({ example: 1 })
  @Transform(({ value }) => (typeof value === 'string' ? Number.parseInt(value, 10) : value))
  @IsInt()
  projectId: number;

  @ApiProperty({ example: '登录页点击登录无响应' })
  @IsString()
  @IsNotEmpty({ message: '标题不能为空' })
  @MaxLength(100)
  title: string;

  @ApiProperty({ enum: ['BLOCKER', 'CRITICAL', 'MAJOR', 'MINOR'] })
  @IsIn(['BLOCKER', 'CRITICAL', 'MAJOR', 'MINOR'], { message: 'severity 必须是 BLOCKER/CRITICAL/MAJOR/MINOR' })
  severity: 'BLOCKER' | 'CRITICAL' | 'MAJOR' | 'MINOR';

  @ApiPropertyOptional({ enum: ['P0', 'P1', 'P2'] })
  @IsOptional()
  @IsIn(['P0', 'P1', 'P2'], { message: 'priority 必须是 P0/P1/P2' })
  priority?: 'P0' | 'P1' | 'P2';

  @ApiProperty({ example: '登录模块' })
  @IsString()
  @IsNotEmpty({ message: '模块不能为空' })
  module: string;

  @ApiProperty({ example: 'Chrome 120 / Windows 11' })
  @IsString()
  @IsNotEmpty({ message: '环境不能为空' })
  environment: string;

  @ApiProperty({ example: '1. 打开登录页\n2. 输入正确账号密码\n3. 点击登录' })
  @IsString()
  @IsNotEmpty({ message: '复现步骤不能为空' })
  steps: string;

  @ApiProperty({ example: '跳转到首页' })
  @IsString()
  @IsNotEmpty({ message: '期望结果不能为空' })
  expected: string;

  @ApiProperty({ example: '点击后无任何反应' })
  @IsString()
  @IsNotEmpty({ message: '实际结果不能为空' })
  actual: string;

  @ApiPropertyOptional({ description: '关联需求 id（可选）' })
  @IsOptional()
  requirementId?: number;

  @ApiPropertyOptional({ description: '关联用例 id（可选）' })
  @IsOptional()
  caseId?: number;

  @ApiPropertyOptional({
    type: [Number],
    description: '提单时已上传的附件 id 列表（可选；上传时 targetId=0 占位，此处回填归属）',
  })
  @IsOptional()
  attachmentIds?: number[];
}
