import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

/** 变更类型（技术方案 8.2：6 类） */
export const CR_TYPES = ['FEATURE', 'BUGFIX', 'HOTFIX', 'CONFIG', 'DEPENDENCY', 'ROLLBACK'] as const;
/** 变更来源 */
export const CR_SOURCE_TYPES = ['BUG', 'REQUIREMENT', 'INCIDENT', 'TECH'] as const;
/** 风险等级 */
export const CR_RISK_LEVELS = ['HIGH', 'MEDIUM', 'LOW'] as const;

export class CreateChangeRequestDto {
  @ApiProperty({ example: 1, description: '所属项目 id' })
  @Transform(({ value }) => (typeof value === 'string' ? Number.parseInt(value, 10) : value))
  @IsInt()
  projectId: number;

  @ApiProperty({ example: '【缺陷修复】登录验证码校验逻辑修正', description: '标题 8-80 字' })
  @IsString()
  @MinLength(8, { message: '标题至少 8 个字符' })
  @MaxLength(80, { message: '标题最多 80 个字符' })
  title: string;

  @ApiProperty({ enum: CR_TYPES, description: '变更类型' })
  @IsIn(CR_TYPES)
  type: string;

  @ApiProperty({ enum: CR_SOURCE_TYPES, description: '变更来源类型' })
  @IsIn(CR_SOURCE_TYPES)
  sourceType: string;

  @ApiPropertyOptional({ example: 3, description: '来源对象 id（Bug/需求 id）' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? Number.parseInt(value, 10) : value))
  @IsInt()
  sourceId?: number;

  @ApiPropertyOptional({ example: 'v1.2.0', description: '归属发布版本' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  version?: string;

  @ApiProperty({ example: 'bugfix/BUG-DEMO-0002-login-fix', description: '源分支（校验命名规范）' })
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  srcBranch: string;

  @ApiProperty({ example: 'main', description: '目标分支' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  dstBranch: string;

  @ApiPropertyOptional({ enum: CR_RISK_LEVELS, description: '风险等级，默认 MEDIUM' })
  @IsOptional()
  @IsIn(CR_RISK_LEVELS)
  riskLevel?: string;

  @ApiPropertyOptional({ description: '是否需要回归，默认 true' })
  @IsOptional()
  needRegression?: boolean;
}

export class CrCommentDto {
  @ApiProperty({ example: '评审意见：方案可行', description: '备注/原因' })
  @IsString()
  @IsNotEmpty({ message: '备注不能为空' })
  comment: string;
}

/** 可选备注：approve/build-done/regression-done/gate-pass 等端点 body 可为空 */
export class CrOptionalCommentDto {
  @ApiPropertyOptional({ example: '回归通过', description: '备注（可选）' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  comment?: string;
}

export class CrMergeDto {
  @ApiPropertyOptional({ example: 'a1b2c3d', description: '合入提交 sha（模拟 GitLab 回写）' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  mergedSha?: string;

  @ApiPropertyOptional({ description: '备注' })
  @IsOptional()
  @IsString()
  comment?: string;
}

export class CrReleaseDto {
  @ApiProperty({ example: 'v1.2.0', description: '发布 Tag' })
  @IsString()
  @IsNotEmpty({ message: 'Tag 不能为空' })
  @MaxLength(40)
  tag: string;

  @ApiPropertyOptional({ description: '备注' })
  @IsOptional()
  @IsString()
  comment?: string;
}
