import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * T1-5 · 用户列表（下拉选择用）：成员邀请弹窗 / 计划负责人选择器需要
 * 只读接口，无分页（MVP 用户规模为个位数）
 */
@ApiTags('user')
@ApiBearerAuth()
@Controller('users')
export class UserController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: '用户列表（成员邀请/负责人选择用）' })
  list() {
    return this.prisma.user.findMany({
      select: { id: true, username: true, realname: true, role: true },
      orderBy: { id: 'asc' },
    });
  }
}
