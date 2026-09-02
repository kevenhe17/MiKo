import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: LoginDto): Promise<{ token: string; user: { id: string; username: string; realname: string; role: string } }> {
    const user = await this.prisma.user.findUnique({ where: { username: dto.username } });
    if (!user) {
      throw new UnauthorizedException('账号或密码错误');
    }

    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('账号或密码错误');
    }

    // JWT payload 只含 sub + role（MVP 约定），附带展示字段便于前端使用
    const token = await this.jwtService.signAsync({
      sub: user.id.toString(),
      role: user.role,
      username: user.username,
      realname: user.realname,
    });

    return {
      token,
      user: {
        id: user.id.toString(),
        username: user.username,
        realname: user.realname,
        role: user.role,
      },
    };
  }

  // MVP 无服务端 session，登出仅做成功响应（前端清 token）
  async logout(): Promise<{ success: true }> {
    return { success: true };
  }
}
