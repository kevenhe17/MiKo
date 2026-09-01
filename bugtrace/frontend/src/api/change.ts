// T5-4 · change 相关 API（变更流转模块前端接口层）
import request from './request';

export type CrStatus =
  | 'DRAFT'
  | 'IN_REVIEW'
  | 'APPROVED'
  | 'BUILDING'
  | 'REGRESSION'
  | 'GATE_CHECK'
  | 'AWAITING_MERGE'
  | 'MERGED'
  | 'RELEASED'
  | 'ABANDONED';

export interface CrUser {
  id: string;
  username: string;
  realname: string;
}

export interface ChangeRequest {
  id: string;
  projectId: string;
  code: string;
  title: string;
  type: 'FEATURE' | 'BUGFIX' | 'HOTFIX' | 'CONFIG' | 'DEPENDENCY' | 'ROLLBACK';
  sourceType: 'BUG' | 'REQUIREMENT' | 'INCIDENT' | 'TECH';
  sourceId: string | null;
  version: string | null;
  srcBranch: string;
  dstBranch: string;
  riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  needRegression: boolean;
  status: CrStatus;
  ownerId: string;
  reviewerId: string | null;
  backflowStatus: 'PENDING' | 'DONE' | null;
  rolledBack: boolean;
  mergedAt: string | null;
  mergedSha: string | null;
  tag: string | null;
  createdAt: string;
  updatedAt: string;
  owner: CrUser | null;
  reviewer: CrUser | null;
  merger: CrUser | null;
}

export interface CrLog {
  id: string;
  action: string;
  fromStatus: CrStatus;
  toStatus: CrStatus;
  comment: string | null;
  createdAt: string;
  operator: CrUser;
}

export interface ChangeRequestDetail extends ChangeRequest {
  project: { id: string; code: string; name: string };
  logs: CrLog[];
}

export function listChanges(params: {
  projectId: number;
  status?: string;
  type?: string;
  sourceType?: string;
  sourceId?: number;
  ownerId?: number;
  page: number;
  pageSize: number;
}) {
  return request.get('/changes', { params }) as unknown as Promise<{
    list: ChangeRequest[];
    total: number;
    page: number;
    pageSize: number;
  }>;
}

export function getChange(id: string) {
  return request.get(`/changes/${id}`) as unknown as Promise<ChangeRequestDetail>;
}

export function createChange(payload: {
  projectId: number;
  title: string;
  type: string;
  sourceType: string;
  sourceId?: number;
  version?: string;
  srcBranch: string;
  dstBranch: string;
  riskLevel?: string;
  needRegression?: boolean;
}) {
  return request.post('/changes', payload) as unknown as Promise<ChangeRequest>;
}

// —— 流转端点（服务端状态机为最终防线，前端仅做按钮显隐） ——

export function submitChange(id: string) {
  return request.post(`/changes/${id}/submit`, {}) as unknown as Promise<ChangeRequestDetail>;
}

export function approveChange(id: string, comment?: string) {
  return request.post(`/changes/${id}/approve`, { comment }) as unknown as Promise<ChangeRequestDetail>;
}

export function rejectReviewChange(id: string, comment: string) {
  return request.post(`/changes/${id}/reject-review`, { comment }) as unknown as Promise<ChangeRequestDetail>;
}

export function startBuildChange(id: string) {
  return request.post(`/changes/${id}/start-build`, {}) as unknown as Promise<ChangeRequestDetail>;
}

export function buildDoneChange(id: string, comment?: string) {
  return request.post(`/changes/${id}/build-done`, { comment }) as unknown as Promise<ChangeRequestDetail>;
}

export function regressionDoneChange(id: string, comment?: string) {
  return request.post(`/changes/${id}/regression-done`, { comment }) as unknown as Promise<ChangeRequestDetail>;
}

export function gatePassChange(id: string, comment?: string) {
  return request.post(`/changes/${id}/gate-pass`, { comment }) as unknown as Promise<ChangeRequestDetail>;
}

export function mergeChange(id: string, payload: { mergedSha?: string; comment?: string }) {
  return request.post(`/changes/${id}/merge`, payload) as unknown as Promise<ChangeRequestDetail>;
}

export function releaseChange(id: string, payload: { tag: string; comment?: string }) {
  return request.post(`/changes/${id}/release`, payload) as unknown as Promise<ChangeRequestDetail>;
}

export function abandonChange(id: string, reason: string) {
  return request.post(`/changes/${id}/abandon`, { comment: reason }) as unknown as Promise<ChangeRequestDetail>;
}

export function backflowDoneChange(id: string) {
  return request.post(`/changes/${id}/backflow-done`, {}) as unknown as Promise<ChangeRequestDetail>;
}

// —— T5-3 统计接口 ——

export interface ChangeOverview {
  total: number;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
  byRisk: Record<string, number>;
  avgMergeHours: number;
  mergedCount: number;
  pendingBackflow: number;
}

export interface ChangeTrendPoint {
  date: string;
  created: number;
  transitions: number;
}

export function getChangeOverview(projectId: number) {
  return request.get('/changes/stats/overview', { params: { projectId } }) as unknown as Promise<ChangeOverview>;
}

export function getChangeTrend(projectId: number, days = 14) {
  return request.get('/changes/stats/trend', { params: { projectId, days } }) as unknown as Promise<{
    days: number;
    series: ChangeTrendPoint[];
  }>;
}

export function getBackflowList(projectId: number) {
  return request.get('/changes/stats/backflow', { params: { projectId } }) as unknown as Promise<
    Array<{
      id: string;
      code: string;
      title: string;
      type: string;
      status: CrStatus;
      srcBranch: string;
      dstBranch: string;
      mergedAt: string | null;
      backflowStatus: string;
      owner: CrUser;
    }>
  >;
}
