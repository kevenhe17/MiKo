// T2-3 · test-case 相关 API
import request from './request';

export interface RequirementSummary {
  id: string;
  code: string;
  title: string;
}

export interface TestCase {
  id: string;
  projectId: string;
  module: string;
  title: string;
  precond?: string;
  steps: string;
  expected: string;
  priority?: 'P0' | 'P1' | 'P2';
  requirementId?: string;
  requirement?: RequirementSummary;
  createdAt: string;
  updatedAt: string;
}

export interface CasePage {
  list: TestCase[];
  total: number;
  page: number;
  pageSize: number;
}

export function listCases(params: {
  projectId?: number;
  module?: string;
  priority?: string;
  page: number;
  pageSize: number;
}) {
  return request.get('/test-cases', { params }) as unknown as Promise<CasePage>;
}

export function getCase(id: string) {
  return request.get(`/test-cases/${id}`) as unknown as Promise<TestCase & {
    project: { id: string; code: string; name: string };
  }>;
}

export function createCase(payload: {
  projectId: number;
  module: string;
  title: string;
  precond?: string;
  steps: string;
  expected: string;
  priority?: string;
}) {
  return request.post('/test-cases', payload) as unknown as Promise<TestCase>;
}

export function updateCase(id: string, payload: Partial<TestCase>) {
  return request.patch(`/test-cases/${id}`, payload) as unknown as Promise<TestCase>;
}

export function deleteCase(id: string) {
  return request.delete(`/test-cases/${id}`) as unknown as Promise<void>;
}

export function linkRequirement(id: string, requirementId: number | null) {
  return request.post(`/test-cases/${id}/requirement`, { requirementId }) as unknown as Promise<TestCase>;
}
