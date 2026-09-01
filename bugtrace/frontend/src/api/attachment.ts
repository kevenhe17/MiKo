// T3-5 · attachment 相关 API（上传走 multipart，即传即入库）
import request from './request';

export interface Attachment {
  id: string;
  projectId: string;
  targetType: 'bug' | 'case';
  targetId: string;
  filename: string;
  filepath: string;
  size: number;
  uploadedBy: string;
  url: string; // 静态直出地址（/uploads/**）
  createdAt: string;
}

/**
 * 上传截图（单文件调用；multipart 字段 file/projectId/targetType）。
 * 提单场景 bug 尚未创建，targetId 不传（后端以 0 占位，提单成功后回填归属）。
 */
export function uploadAttachment(
  file: File,
  meta: { projectId: number; targetType?: 'bug' | 'case' },
) {
  const form = new FormData();
  form.append('file', file);
  form.append('projectId', String(meta.projectId));
  if (meta.targetType) {
    form.append('targetType', meta.targetType);
  }
  return request.post('/attachments', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }) as unknown as Promise<Attachment>;
}
