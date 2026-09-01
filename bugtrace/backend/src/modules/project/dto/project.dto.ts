import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { Role } from '@prisma/client';

export class CreateProjectDto {
  @ApiProperty({ example: 'DEMO' })
  @IsString()
  @IsNotEmpty({ message: '项目 code 不能为空' })
  @MinLength(2, { message: '项目 code 至少 2 个字符' })
  @MaxLength(32, { message: '项目 code 最多 32 个字符' })
  code: string;

  @ApiProperty({ example: '演示项目' })
  @IsString()
  @IsNotEmpty({ message: '项目名称不能为空' })
  name: string;

  @ApiPropertyOptional({ example: '项目描述（可选）' })
  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateProjectDto {
  @ApiPropertyOptional({ example: '演示项目' })
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: '项目名称不能为空' })
  name?: string;

  @ApiPropertyOptional({ example: '项目描述（可选）' })
  @IsOptional()
  @IsString()
  description?: string;
}

export class InviteMemberDto {
  @ApiProperty({ example: 2 })
  @Transform(({ value }) => (typeof value === 'string' ? Number.parseInt(value, 10) : value))
  @IsInt()
  userId: number;

  @ApiProperty({ example: 'DEV', enum: ['ADMIN', 'DEV', 'QA'] })
  @IsIn(['ADMIN', 'DEV', 'QA'], { message: '角色必须是 ADMIN / DEV / QA 之一' })
  role: Role;
}
