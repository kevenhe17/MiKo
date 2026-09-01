// T1-5 · user 列表 API（成员邀请/负责人选择用）
import request from './request';

export interface UserOption {
  id: string;
  username: string;
  realname: string;
  role: string;
}

export function listUsers() {
  return request.get('/users') as unknown as Promise<UserOption[]>;
}
