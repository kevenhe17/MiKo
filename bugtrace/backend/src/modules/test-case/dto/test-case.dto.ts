import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateTestCaseDto {
  @ApiProperty({ example: 1 })
  @Transform(({ value }) => (typeof value === 'string' ? Number.parseInt(value, 10) : value))
  @IsInt()
  projectId: number;

  @ApiProperty({ example: '登录模块' })
  @IsString()
  @IsNotEmpty({ message: '所属模块不能为空' })
  module: string;

  @ApiProperty({ example: '正确账号密码登录成功' })
  @IsString()
  @IsNotEmpty({ message: '用例标题不能为空' })
  title: string;

  @ApiPropertyOptional({ example: '已存在该账号' })
  @IsOptional()
  @IsString()
  precond?: string;

  @ApiProperty({ example: '1. 打开登录页\n2. 输入正确账号密码\n3. 点击登录' })
  @IsString()
  @IsNotEmpty({ message: '操作步骤不能为空' })
  steps: string;

  @ApiProperty({ example: '跳转到首页' })
  @IsString()
  @IsNotEmpty({ message: '期望结果不能为空' })
  expected: string;

  @ApiPropertyOptional({ enum: ['P0', 'P1', 'P2'], description: '默认 P1' })
  @IsOptional()
  @IsIn(['P0', 'P1', 'P2'], { message: 'priority 必须是 P0 / P1 / P2' })
  priority?: 'P0' | 'P1' | 'P2';
}

export class UpdateTestCaseDto {
  @ApiPropertyOptional({ example: '登录模块' })
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: '所属模块不能为空' })
  module?: string;

  @ApiPropertyOptional({ example: '用例标题' })
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: '用例标题不能为空' })
  title?: string;

  @ApiPropertyOptional({ example: '前置条件' })
  @IsOptional()
  @IsString()
  precond?: string;

  @ApiPropertyOptional({ example: '操作步骤' })
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: '操作步骤不能为空' })
  steps?: string;

  @ApiPropertyOptional({ example: '期望结果' })
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: '期望结果不能为空' })
  expected?: string;

  @ApiPropertyOptional({ enum: ['P0', 'P1', 'P2'] })
  @IsOptional()
  @IsIn(['P0', 'P1', 'P2'], { message: 'priority 必须是 P0 / P1 / P2' })
  priority?: 'P0' | 'P1' | 'P2';
}

export class LinkRequirementDto {
  @ApiProperty({ example: 1, nullable: true, description: 'requirement_id；传 null 清除关联' })
  @IsOptional()
  @Transform(({ value }) => (value === null ? null : typeof value === 'string' ? Number.parseInt(value, 10) : value))
  requirementId: number | null;
}
