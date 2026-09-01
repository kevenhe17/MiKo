// T1-5 · project 相关 API
import request from './request';

export interface Project {
  id: string;
  code: string;
  name: string;
  description?: string;
  createdBy: string;
  members: ProjectMember[];
  createdAt: string;
  updatedAt: string;
}

export interface ProjectMember {
  userId: string;
  role: string;
  username?: string;
  realname?: string;
}

export function listProjects(params: { page: number; pageSize: number }) {
  return request.get('/projects', { params }) as unknown as Promise<{
    list: Project[];
    total: number;
    page: number;
    pageSize: number;
  }>;
}

export function getProject(id: string) {
  return request.get(`/projects/${id}`) as unknown as Promise<Project>;
}

export function createProject(payload: { code: string; name: string; description?: string }) {
  return request.post('/projects', payload) as unknown as Promise<Project>;
}

export function inviteMember(id: string, payload: { userId: number; role: string }) {
  return request.post(`/projects/${id}/members`, payload) as unknown as Promise<Project>;
}

export function updateProject(id: string, payload: { name?: string; description?: string }) {
  return request.patch(`/projects/${id}`, payload) as unknown as Promise<Project>;
}

export function deleteProject(id: string) {
  return request.delete(`/projects/${id}`) as unknown as Promise<{ deleted: boolean }>;
}
