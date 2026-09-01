// T1-4 · auth 相关 API
// 注意：request 响应拦截器已统一解包 { code, message, data }，直接返回 data
import request from './request';

export interface LoginResult {
  token: string;
  user: { id: string; username: string; realname: string; role: 'ADMIN' | 'DEV' | 'QA' };
}

export function login(payload: { username: string; password: string }): Promise<LoginResult> {
  return request.post('/auth/login', payload) as unknown as Promise<LoginResult>;
}

export function logout(): Promise<void> {
  return request.post('/auth/logout') as unknown as Promise<void>;
}
