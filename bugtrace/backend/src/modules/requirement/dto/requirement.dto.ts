import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateRequirementDto {
  @ApiProperty({ example: 1, description: '所属项目 id' })
  @Transform(({ value }) => (typeof value === 'string' ? Number.parseInt(value, 10) : value))
  @IsInt()
  projectId: number;

  @ApiProperty({ example: '登录功能' })
  @IsString()
  @IsNotEmpty({ message: '需求标题不能为空' })
  @MaxLength(100, { message: '需求标题最多 100 字' })
  title: string;

  @ApiPropertyOptional({ example: '支持账号密码登录（可选）' })
  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateRequirementDto {
  @ApiPropertyOptional({ example: '登录功能（修订）' })
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: '需求标题不能为空' })
  title?: string;

  @ApiPropertyOptional({ example: '描述（可选）' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: ['OPEN', 'CLOSED'], description: 'MVP 不做删除，用状态表示' })
  @IsOptional()
  @IsIn(['OPEN', 'CLOSED'], { message: '状态必须是 OPEN / CLOSED' })
  status?: 'OPEN' | 'CLOSED';
}
