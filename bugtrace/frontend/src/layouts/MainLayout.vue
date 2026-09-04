<template>
  <el-container class="layout">
    <!-- 顶部导航栏（sticky，毛玻璃背景，64px） -->
    <el-header class="header">
      <div class="header-left">
        <!-- 品牌 Logo -->
        <router-link to="/dashboard" class="logo">
          <img src="/icon.png" alt="BugTrace" class="logo-icon-img" />
          <span class="logo-text">BugTrace</span>
        </router-link>

        <!-- 导航链接组：胶囊按钮 -->
        <nav class="nav-links">
          <router-link
            v-for="item in menus"
            :key="item.path"
            :to="item.path"
            class="nav-link"
            active-class="nav-link-active"
          >
            <el-icon class="nav-icon"><component :is="MENU_ICONS[item.path]" /></el-icon>
            <span>{{ item.title }}</span>
          </router-link>
        </nav>
      </div>

      <div class="header-right">
        <el-button circle size="small" class="icon-btn">
          <el-icon><Search /></el-icon>
        </el-button>
        <el-button circle size="small" class="icon-btn">
          <el-icon><Bell /></el-icon>
        </el-button>
        <div class="user-zone">
          <div class="avatar">{{ avatarChar }}</div>
          <span class="realname">{{ userStore.user?.realname ?? '未登录' }}</span>
          <span class="role-pill" :style="ROLE_STYLE[userStore.user?.role ?? 'DEV']">
            {{ ROLE_LABELS[userStore.user?.role ?? 'DEV'] }}
          </span>
          <el-divider direction="vertical" />
          <el-button link type="danger" @click="onLogout">退出登录</el-button>
        </div>
      </div>
    </el-header>

    <el-main class="main">
      <router-view />
    </el-main>
  </el-container>
</template>

<script setup lang="ts">
// PRD 顶部导航布局：sticky + 毛玻璃 + 胶囊导航按钮 + 右侧用户区
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  Folder, Document, Tickets, Calendar, Aim, Operation,
  Search, Bell,
} from '@element-plus/icons-vue';
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
  ADMIN: { background: '#ede9fe', color: '#7c3aed' },
  DEV: { background: '#dbeafe', color: '#2563eb' },
  QA: { background: '#cffafe', color: '#0891b2' },
};

const menus = computed(() => MENUS[(userStore.user?.role ?? 'DEV') as Role] ?? []);
const avatarChar = computed(() => (userStore.user?.realname ?? 'U').slice(0, 1));

function onLogout() {
  void logout().catch(() => undefined);
  userStore.logout();
  router.push('/login');
}
</script>

<style scoped>
.layout { height: 100%; }

/* —— 顶部导航 —— */
.header {
  position: sticky;
  top: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 64px;
  padding: 0 24px;
  border-bottom: 1px solid var(--bt-border);
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(16px) saturate(180%);
  box-shadow: 0 1px 4px rgba(58, 123, 224, 0.06);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 20px;
}

/* —— Logo —— */
.logo {
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  flex-shrink: 0;
}
.logo-icon-img {
  width: 32px;
  height: 32px;
  border-radius: 9px;
  flex-shrink: 0;
  box-shadow: 0 2px 6px rgba(59, 140, 255, 0.2);
  object-fit: cover;
}
.logo-text {
  font-family: var(--bt-font-display);
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--bt-text-title);
  letter-spacing: 0.3px;
}

/* —— 胶囊导航按钮（PRD：border-radius: 9999px） —— */
.nav-links {
  display: flex;
  align-items: center;
  gap: 4px;
}
.nav-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 18px;
  border-radius: 9999px;
  font-family: var(--bt-font-body);
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--bt-text-muted);
  text-decoration: none;
  transition: all 0.2s ease;
  white-space: nowrap;
}
.nav-link:hover {
  color: var(--bt-text-title);
  background: var(--bt-primary-bg);
}
.nav-link-active {
  color: var(--bt-primary);
  background: var(--bt-primary-bg);
  font-weight: 600;
}
.nav-icon {
  font-size: 16px;
}

/* —— 右侧用户区 —— */
.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}
.icon-btn {
  color: var(--bt-text-muted);
}
.icon-btn:hover {
  color: var(--bt-primary);
  background: var(--bt-primary-bg);
}

.user-zone {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: 8px;
}
.avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--bt-gradient);
  color: #fff;
  font-family: var(--bt-font-display);
  font-size: 14px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.realname {
  font-family: var(--bt-font-body);
  font-size: 0.875rem;
  color: var(--bt-text-body);
  font-weight: 500;
}
.role-pill {
  padding: 2px 10px;
  border-radius: 999px;
  font-family: var(--bt-font-body);
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 18px;
}

/* —— 内容区 —— */
.main {
  padding: 24px;
  background: var(--bt-bg-page);
  min-height: calc(100vh - 64px);
}

/* —— 响应式：小屏隐藏导航链接，留汉堡菜单位置 —— */
@media (max-width: 1023px) {
  .nav-links {
    display: none;
  }
  .realname {
    display: none;
  }
}
@media (max-width: 639px) {
  .header {
    padding: 0 12px;
  }
  .role-pill {
    display: none;
  }
}
</style>
