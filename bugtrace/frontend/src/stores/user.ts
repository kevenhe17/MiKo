// T0-6 · user store：token + 用户信息（先空壳，T1-1/T1-4 接真实数据）
import { defineStore } from 'pinia';

interface UserInfo {
  id: string;
  username: string;
  realname: string;
  role: 'ADMIN' | 'DEV' | 'QA';
}

const TOKEN_KEY = 'bugtrace_token';
const USER_KEY = 'bugtrace_user';

export const useUserStore = defineStore('user', {
  state: () => ({
    token: localStorage.getItem(TOKEN_KEY) ?? '',
    user: JSON.parse(localStorage.getItem(USER_KEY) ?? 'null') as UserInfo | null,
  }),
  actions: {
    setLogin(token: string, user: UserInfo) {
      this.token = token;
      this.user = user;
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    },
    logout() {
      this.token = '';
      this.user = null;
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    },
  },
});
