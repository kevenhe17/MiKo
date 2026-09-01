// T1-5 · requirement 相关 API
import request from './request';

export interface Requirement {
  id: string;
  projectId: string;
  code: string;
  title: string;
  description?: string;
  status: 'OPEN' | 'CLOSED';
  createdAt: string;
  updatedAt: string;
}

export function listRequirements(params: { projectId: number; page: number; pageSize: number }) {
  return request.get('/requirements', { params }) as unknown as Promise<{
    list: Requirement[];
    total: number;
    page: number;
    pageSize: number;
  }>;
}

export function createRequirement(payload: { projectId: number; title: string; description?: string }) {
  return request.post('/requirements', payload) as unknown as Promise<Requirement>;
}

export function updateRequirement(
  id: string,
  payload: { title?: string; description?: string; status?: 'OPEN' | 'CLOSED' },
) {
  return request.patch(`/requirements/${id}`, payload) as unknown as Promise<Requirement>;
}

export function deleteRequirement(id: string) {
  return request.delete(`/requirements/${id}`) as unknown as Promise<{ deleted: boolean }>;
}
