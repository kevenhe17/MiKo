// T0-6 · Axios 封装：统一 baseURL、自动携带 token、401 跳登录
// T1-4 · 响应统一解包 { code, message, data }：code≠0 抛业务错误
import axios, { AxiosError, type AxiosRequestConfig } from 'axios';
import { ElMessage } from 'element-plus';

const request = axios.create({
  baseURL: import.meta.env.VITE_API_BASE ?? '/api',
  timeout: 15000,
});

// 请求拦截器：自动带 Authorization: Bearer <token>
request.interceptors.request.use((config) => {
  const token = localStorage.getItem('bugtrace_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 响应拦截器：
//  - 业务统一响应 { code, message, data }：code=0 → 直接返回 data
//  - 401 → 清 token 跳登录；其他错误 → 可读提示
request.interceptors.response.use(
  (response) => {
    const body = response.data as { code: number; message: string; data: unknown };
    if (body && typeof body.code === 'number') {
      if (body.code !== 0) {
        ElMessage.error(body.message || '操作失败');
        return Promise.reject(new Error(body.message || '操作失败'));
      }
      return body.data as never;
    }
    return body as never;
  },
  (error: AxiosError<{ message?: string }>) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('bugtrace_token');
      localStorage.removeItem('bugtrace_user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    } else {
      // 网络层失败（无响应）时给出具体原因，便于定位（代理未启动/连接拒绝/超时等）
      const detail =
        error.response?.data?.message ??
        (error.code === 'ECONNABORTED'
          ? '请求超时，请稍后重试'
          : `网络异常（${error.code ?? 'UNKNOWN'}: ${error.message}）`);
      ElMessage.error({ message: detail, duration: 6000 });
    }
    return Promise.reject(error);
  },
);

export default request;
export type { AxiosRequestConfig };
