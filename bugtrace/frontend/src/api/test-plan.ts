// T2-4 · test-plan 相关 API
import request from './request';
import type { TestCase } from './test-case';

export interface TestPlan {
  id: string;
  projectId: string;
  name: string;
  ownerId: string;
  caseIds: unknown;
  status: string;
  caseCount?: number;
  owner?: { id: string; username: string; realname: string };
  createdAt: string;
  updatedAt: string;
}

export interface TestPlanDetail extends TestPlan {
  project: { id: string; code: string; name: string };
  cases: Array<Pick<TestCase, 'id' | 'module' | 'title' | 'priority' | 'expected'> & {
    requirement?: { id: string; code: string; title: string };
  }>;
}

export function listPlans(params: { page: number; pageSize: number; projectId?: number }) {
  return request.get('/test-plans', { params }) as unknown as Promise<{
    list: TestPlan[];
    total: number;
    page: number;
    pageSize: number;
  }>;
}

export function getPlan(id: string) {
  return request.get(`/test-plans/${id}`) as unknown as Promise<TestPlanDetail>;
}

export function createPlan(payload: {
  projectId: number;
  name: string;
  ownerId: number;
  caseIds: number[];
}) {
  return request.post('/test-plans', payload) as unknown as Promise<TestPlan>;
}
