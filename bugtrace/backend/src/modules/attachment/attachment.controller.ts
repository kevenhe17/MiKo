import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { AttachmentService } from './attachment.service';

const ALLOWED_EXTS = ['.png', '.jpg', '.jpeg'];
const ALLOWED_MIMES = ['image/png', 'image/jpeg'];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

@ApiTags('attachment')
@ApiBearerAuth()
@Controller('attachments')
export class AttachmentController {
  constructor(private readonly attachmentService: AttachmentService) {}

  @Post()
  @ApiOperation({ summary: '上传附件（multipart 单文件，≤5MB，仅 png/jpg/jpeg，登录可传）' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      // 硬限制：流超限即中断（multer 抛 413，由下方 fileFilter 统一转 400 的策略互补）
      limits: { fileSize: MAX_SIZE },
      fileFilter: (_req, file, cb) => {
        const okMime = ALLOWED_MIMES.includes(file.mimetype);
        const okExt = ALLOWED_EXTS.some((e) => file.originalname.toLowerCase().endsWith(e));
        if (!okMime || !okExt) {
          return cb(new BadRequestException('仅支持 png / jpg / jpeg 图片'), false);
        }
        if (file.size > MAX_SIZE) {
          return cb(new BadRequestException('文件大小不能超过 5MB'), false);
        }
        cb(null, true);
      },
    }),
  )
  upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { projectId?: string; targetType?: string; targetId?: string },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.attachmentService.upload(
      file,
      { projectId: body.projectId, targetType: body.targetType, targetId: body.targetId },
      user.sub,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: '下载附件（stream）' })
  download(@Param('id') id: string): Promise<StreamableFile> {
    return this.attachmentService.download(id);
  }
}
