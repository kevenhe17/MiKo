import {
  BadRequestException,
  Injectable,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { existsSync } from 'fs';
import { createReadStream } from 'fs';
import { mkdir, writeFile } from 'fs/promises';
import { randomUUID } from 'crypto';
import { dirname, extname, resolve } from 'path';
import { PrismaService } from '../../prisma/prisma.service';

/** 上传根目录（相对后端运行目录 backend/） */
const UPLOAD_ROOT = resolve(process.cwd(), 'uploads');

export interface UploadMeta {
  projectId?: string;
  targetType?: string;
  targetId?: string;
}

/**
 * T3-3 · 附件服务：本地 uploads 存储（MVP 不做 MinIO/OSS）。
 * 存储路径 uploads/{yyyyMM}/{uuid}.{ext}；DB 记录 filepath 为正斜杠相对路径，
 * 与静态直出 URL（GET /uploads/**）保持一致。
 */
@Injectable()
export class AttachmentService {
  constructor(private readonly prisma: PrismaService) {}

  async upload(
    file: Express.Multer.File,
    meta: UploadMeta,
    uploaderId: string,
  ) {
    if (!file) {
      throw new BadRequestException('缺少文件字段 file');
    }
    const projectId = Number.parseInt(meta.projectId ?? '', 10);
    if (!projectId) {
      throw new BadRequestException('projectId 不能为空');
    }
    const project = await this.prisma.project.findUnique({ where: { id: BigInt(projectId) } });
    if (!project) {
      throw new BadRequestException('所属项目不存在');
    }

    // 存储路径：uploads/{yyyyMM}/{uuid}.{ext}
    const month = new Date().toISOString().slice(0, 7).replace('-', '');
    const ext = extname(file.originalname).toLowerCase();
    const relPath = `uploads/${month}/${randomUUID()}${ext}`;
    const absPath = resolve(process.cwd(), relPath);
    await mkdir(dirname(absPath), { recursive: true });
    await writeFile(absPath, file.buffer);

    // T3-3 不做 target 归属校验（T3-5 联调时补）；targetId 未知时以 0 占位
    const record = await this.prisma.attachment.create({
      data: {
        projectId: project.id,
        targetType: meta.targetType === 'case' ? 'case' : 'bug',
        targetId: meta.targetId ? BigInt(meta.targetId) : BigInt(0),
        filename: file.originalname,
        filepath: relPath,
        size: file.size,
        uploadedBy: BigInt(uploaderId),
      },
      include: {
        uploader: { select: { id: true, username: true, realname: true } },
      },
    });

    // 可访问 URL：静态目录 /uploads/* 直出（见 main.ts useStaticAssets）
    return { ...record, url: `/${relPath}` };
  }

  /** 下载：按 DB 记录 stream 直出 */
  async download(id: string): Promise<StreamableFile> {
    const record = await this.prisma.attachment.findUnique({
      where: { id: BigInt(id) },
    });
    if (!record) {
      throw new NotFoundException('附件不存在');
    }
    const absPath = resolve(process.cwd(), record.filepath);
    if (!existsSync(absPath)) {
      throw new NotFoundException('附件文件已丢失');
    }
    return new StreamableFile(createReadStream(absPath), {
      type: record.filepath.endsWith('.png') ? 'image/png' : 'image/jpeg',
      disposition: `attachment; filename="${encodeURIComponent(record.filename)}"`,
      length: record.size,
    });
  }

  /** 供静态服务使用的根目录（main.ts 引用，保证单一路径来源） */
  static get uploadRoot(): string {
    return UPLOAD_ROOT;
  }
}
