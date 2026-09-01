<template>
  <el-container class="layout">
    <el-aside width="228px" class="aside">
      <div class="logo">
        <div class="logo-mark">B</div>
        <div class="logo-text">
          <span class="name">BugTrace</span>
          <span class="slogan">缺陷跟踪 · MVP</span>
        </div>
      </div>
      <el-menu :default-active="route.path" router class="menu">
        <el-menu-item v-for="item in menus" :key="item.path" :index="item.path">
          <el-icon class="menu-icon"><component :is="MENU_ICONS[item.path]" /></el-icon>
          <span>{{ item.title }}</span>
        </el-menu-item>
      </el-menu>
      <div class="aside-foot">© BugTrace MVP</div>
    </el-aside>
    <el-container class="right">
      <el-header class="header">
        <div class="header-left">
          <span class="page-label">{{ currentTitle }}</span>
        </div>
        <div class="user-zone">
          <div class="avatar">{{ avatarChar }}</div>
          <span class="realname">{{ userStore.user?.realname ?? '未登录' }}</span>
          <span class="role-pill" :style="ROLE_STYLE[userStore.user?.role ?? 'DEV']">
            {{ ROLE_LABELS[userStore.user?.role ?? 'DEV'] }}
          </span>
          <el-divider direction="vertical" />
          <el-button link type="danger" @click="onLogout">退出登录</el-button>
        </div>
      </el-header>
      <el-main class="main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup lang="ts">
// T0-6 · 主布局；T1-5 · 菜单由 permission.const.ts 的 MENUS 数据驱动
// U2 · 活泼产品风视觉：品牌 logo 区 + 图标菜单 + 顶栏角色徽标（仅样式，不动业务逻辑）
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Folder, Document, Tickets, Calendar, Aim, Operation } from '@element-plus/icons-vue';
import { useUserStore } from '../stores/user';
import { logout } from '../api/auth';
import { MENUS, type Role } from '../constants/permission.const';

const route = useRoute();
const router = useRouter();
const userStore = useUserStore();

/** 菜单图标映射（按 path 固定分配） */
const MENU_ICONS: Record<string, unknown> = {
  '/projects': Folder,
  '/requirements': Document,
  '/cases': Tickets,
  '/plans': Calendar,
  '/bugs': Aim,
  '/changes': Operation,
};

const ROLE_LABELS: Record<Role, string> = { ADMIN: '管理员', DEV: '开发', QA: '测试' };
const ROLE_STYLE: Record<Role, { background: string; color: string }> = {
  ADMIN: { background: '#f3e8ff', color: '#7c3aed' },
  DEV: { background: '#dbeafe', color: '#2563eb' },
  QA: { background: '#cffafe', color: '#0891b2' },
};

const menus = computed(() => MENUS[(userStore.user?.role ?? 'DEV') as Role] ?? []);
const avatarChar = computed(() => (userStore.user?.realname ?? 'U').slice(0, 1));
const currentTitle = computed(
  () => menus.value.find((m) => route.path.startsWith(m.path))?.title ?? '',
);

function onLogout() {
  // 通知后端（MVP 无 session，失败不阻塞）；随后清本地登录态
  void logout().catch(() => undefined);
  userStore.logout();
  router.push('/login');
}
</script>

<style scoped>
.layout { height: 100%; }

/* —— 侧边栏 —— */
.aside {
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--bt-border);
  background: #fff;
}

.logo {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px 18px;
  border-bottom: 1px solid var(--bt-border);
}
.logo-mark {
  width: 38px;
  height: 38px;
  border-radius: 12px;
  background: var(--bt-gradient);
  color: #fff;
  font-size: 20px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.35);
}
.logo-text { display: flex; flex-direction: column; line-height: 1.2; }
.logo-text .name { font-size: 17px; font-weight: 700; color: var(--bt-text-title); letter-spacing: 0.3px; }
.logo-text .slogan { font-size: 11px; color: var(--bt-text-muted); margin-top: 2px; }

.menu {
  flex: 1;
  border-right: none;
  padding: 10px;
}
.menu :deep(.el-menu-item) {
  height: 44px;
  line-height: 44px;
  margin: 4px 0;
  border-radius: 10px;
  color: var(--bt-text-body);
  transition: all 0.2s ease;
}
.menu :deep(.el-menu-item .menu-icon) { font-size: 17px; margin-right: 4px; }
.menu :deep(.el-menu-item:hover) {
  background: var(--bt-primary-bg);
  color: var(--bt-primary-dark);
}
.menu :deep(.el-menu-item.is-active) {
  background: var(--bt-gradient);
  color: #fff;
  font-weight: 600;
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.35);
}

.aside-foot {
  padding: 14px;
  font-size: 11px;
  color: var(--bt-text-muted);
  text-align: center;
  border-top: 1px solid var(--bt-border);
}

/* —— 顶栏 —— */
.header {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 60px;
  border-bottom: 1px solid var(--bt-border);
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(8px);
}
.page-label { font-size: 15px; font-weight: 600; color: var(--bt-text-title); }

.user-zone { display: flex; align-items: center; gap: 10px; }
.avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--bt-gradient);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}
.realname { font-size: 14px; color: var(--bt-text-body); font-weight: 500; }
.role-pill {
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  line-height: 18px;
}

/* —— 内容区 —— */
.main {
  padding: 20px;
  background: var(--bt-bg-page);
}
</style>
