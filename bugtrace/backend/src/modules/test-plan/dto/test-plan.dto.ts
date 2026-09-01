import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, ArrayUnique, IsArray, IsInt, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

function toInt(value: unknown): number {
  return typeof value === 'string' ? Number.parseInt(value, 10) : (value as number);
}

export class CreateTestPlanDto {
  @ApiProperty({ example: 1 })
  @Transform(({ value }) => toInt(value))
  @IsInt()
  projectId: number;

  @ApiProperty({ example: 'V1.0 回归测试计划' })
  @IsString()
  @IsNotEmpty({ message: '计划名称不能为空' })
  @MaxLength(100)
  name: string;

  @ApiProperty({ example: 3 })
  @Transform(({ value }) => toInt(value))
  @IsInt()
  ownerId: number;

  @ApiProperty({ example: [1, 2, 3], type: [Number] })
  @Transform(({ value }) => (Array.isArray(value) ? value.map(toInt) : value))
  @IsArray()
  @ArrayNotEmpty({ message: '至少勾选一个用例' })
  @ArrayUnique({ message: '用例不能重复勾选' })
  @IsInt({ each: true })
  caseIds: number[];
}
