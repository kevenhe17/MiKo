<template>
  <a-layout class="layout">
    <!-- 顶部导航栏（sticky，毛玻璃背景，64px） -->
    <a-layout-header class="header">
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
            <component :is="MENU_ICONS[item.path]" class="nav-icon" />
            <span>{{ item.title }}</span>
          </router-link>
        </nav>
      </div>

      <div class="header-right">
        <a-tooltip title="搜索" placement="bottom">
          <button class="icon-btn" type="button" aria-label="搜索">
            <SearchOutlined />
          </button>
        </a-tooltip>

        <a-tooltip title="通知" placement="bottom">
          <a-badge dot :offset="[-4, 4]">
            <button class="icon-btn" type="button" aria-label="通知">
              <BellOutlined />
            </button>
          </a-badge>
        </a-tooltip>

        <!-- 用户区：收纳进下拉菜单，避免把「退出登录」直接暴露在主界面 -->
        <a-dropdown placement="bottomRight" :trigger="['click']">
          <button class="user-zone" type="button">
            <a-avatar class="avatar" :size="32">{{ avatarChar }}</a-avatar>
            <span class="realname">{{ userStore.user?.realname ?? '未登录' }}</span>
            <a-tag class="role-pill" :color="ROLE_TAG_COLOR[userStore.user?.role ?? 'DEV']">
              {{ ROLE_LABELS[userStore.user?.role ?? 'DEV'] }}
            </a-tag>
            <DownOutlined class="caret" />
          </button>

          <template #overlay>
            <a-menu class="user-menu" @click="onUserMenuClick">
              <div class="user-menu-head">
                <div class="um-name">{{ userStore.user?.realname ?? '未登录' }}</div>
                <div class="um-account">@{{ userStore.user?.username ?? '-' }}</div>
              </div>
              <a-menu-divider />
              <a-menu-item key="logout" danger>
                <template #icon><LogoutOutlined /></template>
                退出登录
              </a-menu-item>
            </a-menu>
          </template>
        </a-dropdown>
      </div>
    </a-layout-header>

    <a-layout-content class="main">
      <router-view />
    </a-layout-content>
  </a-layout>
</template>

<script setup lang="ts">
// v0.2 · 迁移到 Ant Design Vue：Layout/Dropdown/Badge/Tooltip/Avatar/Tag
// 视觉沿用 PRD 的毛玻璃 + 胶囊导航，组件能力由 antdv 提供
import { computed, markRaw } from 'vue';
import { useRouter } from 'vue-router';
import {
  FolderOutlined,
  FileTextOutlined,
  ProfileOutlined,
  CalendarOutlined,
  BugOutlined,
  SwapOutlined,
  SearchOutlined,
  BellOutlined,
  LogoutOutlined,
  DownOutlined,
} from '@ant-design/icons-vue';
import { useUserStore } from '../stores/user';
import { logout } from '../api/auth';
import { MENUS, type Role } from '../constants/permission.const';

const router = useRouter();
const userStore = useUserStore();

/** 菜单图标映射（按 path 固定分配） */
const MENU_ICONS: Record<string, unknown> = {
  '/projects': markRaw(FolderOutlined),
  '/requirements': markRaw(FileTextOutlined),
  '/cases': markRaw(ProfileOutlined),
  '/plans': markRaw(CalendarOutlined),
  '/bugs': markRaw(BugOutlined),
  '/changes': markRaw(SwapOutlined),
};

const ROLE_LABELS: Record<Role, string> = { ADMIN: '管理员', DEV: '开发', QA: '测试' };
/** antd Tag 预设色板，语义与设计稿一致：管理员紫 / 开发蓝 / 测试青 */
const ROLE_TAG_COLOR: Record<Role, string> = { ADMIN: 'purple', DEV: 'blue', QA: 'cyan' };

const menus = computed(() => MENUS[(userStore.user?.role ?? 'DEV') as Role] ?? []);
const avatarChar = computed(() => (userStore.user?.realname ?? 'U').slice(0, 1));

function onUserMenuClick({ key }: { key: string | number }) {
  if (key === 'logout') onLogout();
}

function onLogout() {
  void logout().catch(() => undefined);
  userStore.logout();
  router.push('/login');
}
</script>

<style scoped>
.layout {
  height: 100%;
}

/* —— 顶部导航（覆盖 antd Layout.Header 默认底纹，改为毛玻璃） —— */
.layout .header {
  position: sticky;
  top: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 64px;
  line-height: normal;
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
  gap: 5px;
  padding: 6px 18px;
  border-radius: 9999px;
  font-family: var(--bt-font-body);
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--bt-text-muted);
  text-decoration: none;
  transition: color 0.2s ease, background 0.2s ease;
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
  font-size: 15px;
}

/* —— 右侧操作区 —— */
.header-right {
  display: flex;
  align-items: center;
  gap: 6px;
}

/* 图标按钮：44px 触达区 + 24px 视觉尺寸 */
.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: var(--bt-text-muted);
  font-size: 17px;
  cursor: pointer;
  transition: color 0.15s ease, background 0.15s ease;
}
.icon-btn:hover {
  color: var(--bt-primary);
  background: var(--bt-primary-bg);
}
.icon-btn:focus-visible {
  outline: 2px solid var(--bt-primary);
  outline-offset: 2px;
}

/* —— 用户区（下拉触发器） —— */
.user-zone {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: 6px;
  padding: 4px 8px 4px 4px;
  border: none;
  border-radius: 999px;
  background: transparent;
  cursor: pointer;
  transition: background 0.15s ease;
}
.user-zone:hover {
  background: var(--bt-primary-bg);
}
.avatar {
  background: var(--bt-gradient);
  color: #fff;
  font-family: var(--bt-font-display);
  font-weight: 700;
  flex-shrink: 0;
}
.realname {
  font-family: var(--bt-font-body);
  font-size: 0.875rem;
  color: var(--bt-text-body);
  font-weight: 500;
}
.role-pill {
  margin-inline-end: 0;
  border: none;
  font-family: var(--bt-font-body);
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 18px;
  padding-inline: 8px;
}
.caret {
  font-size: 10px;
  color: var(--bt-text-muted);
}

/* —— 内容区 —— */
.layout .main {
  padding: 24px;
  background: var(--bt-bg-page);
  min-height: calc(100vh - 64px);
}

/* —— 响应式 —— */
@media (max-width: 1023px) {
  .nav-links {
    display: none;
  }
  .realname {
    display: none;
  }
}
@media (max-width: 639px) {
  .layout .header {
    padding: 0 12px;
  }
  .role-pill {
    display: none;
  }
}
</style>

<!-- 下拉菜单渲染在 body 下，scoped 无法命中，需用非 scoped 块 -->
<style>
.user-menu {
  min-width: 180px;
}
.user-menu .user-menu-head {
  padding: 10px 12px 8px;
}
.user-menu .um-name {
  font-weight: 600;
  color: var(--bt-text-title);
  font-size: 14px;
  line-height: 1.4;
}
.user-menu .um-account {
  font-size: 12px;
  color: var(--bt-text-muted);
  line-height: 1.4;
}
</style>
