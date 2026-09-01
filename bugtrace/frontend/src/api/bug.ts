// T3-4 · bug 相关 API
import request from './request';

export interface BugOwner {
  id: string;
  username: string;
  realname: string;
}

export interface Bug {
  id: string;
  code: string;
  title: string;
  severity: 'BLOCKER' | 'CRITICAL' | 'MAJOR' | 'MINOR';
  priority: string;
  status: 'NEW' | 'ASSIGNED' | 'IN_PROGRESS' | 'FIXED' | 'VERIFIED' | 'CLOSED';
  module: string | null;
  environment: string | null;
  owner: BugOwner | null;
  fixer: BugOwner | null;
  updatedAt: string;
  createdAt: string;
}

export function listBugs(params: {
  status?: string;
  severity?: string;
  ownerId?: number;
  page: number;
  pageSize: number;
}) {
  return request.get('/bugs', { params }) as unknown as Promise<{
    list: Bug[];
    total: number;
    page: number;
    pageSize: number;
  }>;
}

// T3-5 · 提单：projectId 必填 + 必填六项 + 可选关联；attachmentIds 回填截图归属
export function createBug(payload: {
  projectId: number;
  title: string;
  severity: string;
  priority?: string;
  module: string;
  environment: string;
  steps: string;
  expected: string;
  actual: string;
  requirementId?: number;
  caseId?: number;
  attachmentIds?: number[];
}) {
  return request.post('/bugs', payload) as unknown as Promise<Bug>;
}

// —— T3-6 · 详情 + 流转（服务端校验为最终防线，前端仅做按钮显隐）——

export interface BugLog {
  id: string;
  action: string;
  fromStatus: string;
  toStatus: string;
  comment: string | null;
  createdAt: string;
  operator: { id: string; username: string; realname: string };
}

export interface BugDetail extends Bug {
  project: { id: string; code: string; name: string };
  priority: string | null;
  steps: string;
  expected: string;
  actual: string;
  rootCause: string | null;
  fixDesc: string | null;
  impact: string | null;
  requirement: { id: string; code: string; title: string } | null;
  case: { id: string; module: string; title: string; priority: string | null } | null;
  logs: BugLog[];
  attachments: {
    id: string;
    filename: string;
    filepath: string;
    size: number;
  }[];
}

export function getBug(id: string) {
  return request.get(`/bugs/${id}`) as unknown as Promise<BugDetail>;
}

export function assignBug(id: string, payload: { ownerId: number; comment?: string }) {
  return request.post(`/bugs/${id}/assign`, payload) as unknown as Promise<BugDetail>;
}

export function startBug(id: string) {
  return request.post(`/bugs/${id}/start`) as unknown as Promise<BugDetail>;
}

export function fixBug(
  id: string,
  payload: { rootCause: string; fixDesc: string; impact: string },
) {
  return request.post(`/bugs/${id}/fix`, payload) as unknown as Promise<BugDetail>;
}

export function verifyBug(id: string, payload: { passed: boolean; comment?: string }) {
  return request.post(`/bugs/${id}/verify`, payload) as unknown as Promise<BugDetail>;
}

export function closeBug(id: string, comment?: string) {
  return request.post(`/bugs/${id}/close`, { comment }) as unknown as Promise<BugDetail>;
}

export function reopenBug(id: string, comment: string) {
  return request.post(`/bugs/${id}/reopen`, { comment }) as unknown as Promise<BugDetail>;
}

export function rejectBug(id: string, reason: string) {
  return request.post(`/bugs/${id}/reject`, { reason }) as unknown as Promise<BugDetail>;
}
