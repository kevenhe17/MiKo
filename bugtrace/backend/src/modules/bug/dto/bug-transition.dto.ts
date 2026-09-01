import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

function toInt(value: unknown): number {
  return typeof value === 'string' ? Number.parseInt(value, 10) : (value as number);
}

export class AssignBugDto {
  @ApiProperty({ example: 2, description: '被分派人（处理人）userId' })
  @Transform(({ value }) => toInt(value))
  @IsInt()
  ownerId: number;

  @ApiPropertyOptional({ example: '请优先处理' })
  @IsOptional()
  @IsString()
  comment?: string;
}

export class FixBugDto {
  @ApiProperty({ example: '空指针：token 为 null 未判空' })
  @IsString()
  @IsNotEmpty({ message: 'root_cause（原因分析）不能为空' })
  rootCause: string;

  @ApiProperty({ example: '增加判空与默认值' })
  @IsString()
  @IsNotEmpty({ message: 'fix_desc（修复说明）不能为空' })
  fixDesc: string;

  @ApiProperty({ example: '影响登录主流程，需回归' })
  @IsString()
  @IsNotEmpty({ message: 'impact（影响评估）不能为空' })
  impact: string;
}

export class VerifyBugDto {
  @ApiProperty({ example: true, description: 'true=验证通过；false=回归失败重开' })
  @IsBoolean()
  passed: boolean;

  @ApiPropertyOptional({ example: '验证通过，符合预期' })
  @IsOptional()
  @IsString()
  comment?: string;
}

export class CloseBugDto {
  @ApiPropertyOptional({ example: '验证通过，关闭缺陷' })
  @IsOptional()
  @IsString()
  comment?: string;
}

export class CommentBugDto {
  @ApiProperty({ example: '重开原因说明' })
  @IsString()
  @IsNotEmpty({ message: '备注不能为空' })
  comment: string;
}

export class RejectBugDto {
  @ApiProperty({ example: '重复缺陷' })
  @IsString()
  @IsNotEmpty({ message: '拒绝原因不能为空' })
  reason: string;
}
