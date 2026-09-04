<template>
  <div class="dashboard">
    <!-- Hero 区域 -->
    <div class="hero">
      <p class="greeting">工作台</p>
      <h1 class="hero-title">
        你好，{{ userStore.user?.realname ?? '用户' }}
      </h1>
      <p class="hero-subtitle">今天是 {{ today }}，以下是项目概览</p>
    </div>

    <!-- Bento Grid 统计卡 -->
    <el-row :gutter="16" class="stat-row">
      <el-col :xs="12" :sm="12" :md="6" v-for="stat in stats" :key="stat.label">
        <div class="stat-card" :class="{ 'stat-card--trend-up': stat.trend > 0, 'stat-card--trend-down': stat.trend < 0 }">
          <div class="stat-top">
            <div class="stat-icon" :style="{ background: stat.iconBg, color: stat.iconColor }">
              <el-icon :size="22"><component :is="stat.icon" /></el-icon>
            </div>
            <div v-if="stat.trend !== 0" class="stat-trend" :class="stat.trend > 0 ? 'trend-up' : 'trend-down'">
              <el-icon><ArrowUp v-if="stat.trend > 0" /><ArrowDown v-else /></el-icon>
              <span>{{ Math.abs(stat.trend) }}%</span>
            </div>
          </div>
          <div class="stat-value">{{ stat.value }}</div>
          <div class="stat-label">{{ stat.label }}</div>
        </div>
      </el-col>
    </el-row>

    <!-- 项目卡片（两列） -->
    <div class="section-header">
      <h3 class="section-title">最近项目</h3>
      <el-button type="primary" text @click="$router.push('/projects')">查看全部</el-button>
    </div>
    <el-row :gutter="20" class="project-row">
      <el-col :xs="24" :sm="24" :md="12" :lg="8" v-for="project in projects" :key="project.id">
        <el-card shadow="hover" class="project-card" @click="$router.push(`/requirements?projectId=${project.id}`)">
          <div class="project-header">
            <div class="project-icon" :style="{ background: project.color }">
              <el-icon :size="24" color="#fff"><Folder /></el-icon>
            </div>
            <el-button link size="small" @click.stop>
              <el-icon><MoreFilled /></el-icon>
            </el-button>
          </div>
          <div class="project-name">{{ project.name }}</div>
          <div class="project-desc">{{ project.description || '暂无描述' }}</div>
          <div class="project-footer">
            <div class="project-members">
              <div v-for="(m, i) in project.memberAvatars" :key="i" class="member-avatar" :style="{ background: m.color, zIndex: project.memberAvatars.length - i }">
                {{ m.char }}
              </div>
            </div>
            <div class="project-meta">
              <el-tag size="small" effect="plain" type="info">{{ project.code }}</el-tag>
              <span class="project-date">{{ formatDate(project.createdAt) }}</span>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 最近动态 -->
    <div class="section-header" style="margin-top: 24px;">
      <h3 class="section-title">最近动态</h3>
    </div>
    <el-card shadow="never" class="activity-card">
      <div v-for="item in activities" :key="item.id" class="activity-item">
        <div class="activity-dot" :style="{ background: item.color }"></div>
        <div class="activity-content">
          <span class="activity-text">
            <b>{{ item.actor }}</b> {{ item.action }}
          </span>
          <span class="activity-target">{{ item.target }}</span>
        </div>
        <span class="activity-time">{{ formatTime(item.createdAt) }}</span>
      </div>
      <el-empty v-if="!activities.length" description="暂无动态" :image-size="60" />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import {
  Folder, Document, Tickets, Calendar, Warning, Operation,
  ArrowUp, ArrowDown, MoreFilled,
} from '@element-plus/icons-vue';
import { useUserStore } from '../../stores/user';
import { listProjects, type Project } from '../../api/project';
import { listBugs, type Bug as BugType } from '../../api/bug';
import { listRequirements, type Requirement } from '../../api/requirement';
import { listPlans, type TestPlan } from '../../api/test-plan';
import { listChanges, type ChangeRequest } from '../../api/change';

const userStore = useUserStore();

const today = computed(() => {
  const d = new Date();
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
});

const projects = ref<Project[]>([]);
const bugs = ref<BugType[]>([]);
const requirements = ref<Requirement[]>([]);
const plans = ref<TestPlan[]>([]);
const changes = ref<ChangeRequest[]>([]);
const activities = ref<Array<{
  id: string;
  actor: string;
  action: string;
  target: string;
  color: string;
  createdAt: string;
}>>([]);

const stats = computed(() => [
  {
    label: '项目总数',
    value: projects.value.length,
    trend: 0,
    icon: Folder,
    iconBg: '#dbeafe',
    iconColor: '#2563eb',
  },
  {
    label: '需求总数',
    value: requirements.value.total ?? requirements.value.length,
    trend: 0,
    icon: Document,
    iconBg: '#dcfce7',
    iconColor: '#16a34a',
  },
  {
    label: '缺陷总数',
    value: bugs.value.total ?? bugs.value.length,
    trend: 12,
    icon: Warning,
    iconBg: '#fee2e2',
    iconColor: '#dc2626',
  },
  {
    label: '测试计划',
    value: plans.value.total ?? plans.value.length,
    trend: 0,
    icon: Calendar,
    iconBg: '#fef3c7',
    iconColor: '#d97706',
  },
]);

function formatTime(value: string) {
  if (!value) return '';
  const d = new Date(value);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return '刚刚';
  if (diffMin < 60) return `${diffMin}分钟前`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}小时前`;
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay}天前`;
}

function formatDate(value: string) {
  if (!value) return '';
  const d = new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const DOT_COLORS = {
  create: '#22c55e',
  update: '#3A7BE0',
  delete: '#ef4444',
};

async function loadAll() {
  const [pRes, rRes, bRes, plRes, cRes] = await Promise.all([
    listProjects({ page: 1, pageSize: 6 }),
    listRequirements({ projectId: 0, page: 1, pageSize: 5 }),
    listBugs({ page: 1, pageSize: 5 }),
    listPlans({ page: 1, pageSize: 5 }),
    listChanges({ projectId: 0, page: 1, pageSize: 5 }),
  ]);
  projects.value = pRes.list;
  requirements.value = rRes;
  bugs.value = bRes;
  plans.value = plRes;
  changes.value = cRes;

  // 构建动态列表
  const acts: typeof activities.value = [];
  for (const r of rRes.list.slice(0, 3)) {
    acts.push({
      id: `req-${r.id}`,
      actor: '系统',
      action: '创建了需求',
      target: r.code + ' · ' + r.title,
      color: DOT_COLORS.create,
      createdAt: r.createdAt,
    });
  }
  for (const b of bRes.list.slice(0, 2)) {
    acts.push({
      id: `bug-${b.id}`,
      actor: b.owner?.realname ?? '未知',
      action: '提交了缺陷',
      target: b.code + ' · ' + b.title,
      color: b.status === 'NEW' ? DOT_COLORS.create : DOT_COLORS.update,
      createdAt: b.updatedAt,
    });
  }
  for (const c of cRes.list.slice(0, 2)) {
    acts.push({
      id: `cr-${c.id}`,
      actor: c.owner?.realname ?? '未知',
      action: '创建了变更单',
      target: c.code + ' · ' + c.title,
      color: DOT_COLORS.create,
      createdAt: c.updatedAt,
    });
  }
  acts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  activities.value = acts.slice(0, 10);
}

onMounted(() => {
  void loadAll();
});
</script>

<style scoped>
.dashboard {
  max-width: 1400px;
}

/* —— Hero —— */
.hero {
  margin-bottom: 32px;
}
.greeting {
  font-family: var(--bt-font-body);
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--bt-primary);
  margin: 0 0 4px;
}
.hero-title {
  font-family: var(--bt-font-display);
  font-size: clamp(1.75rem, 4vw, 2.5rem);
  font-weight: 700;
  margin: 0;
  color: var(--bt-text-title);
  letter-spacing: -0.02em;
}
.hero-subtitle {
  font-family: var(--bt-font-body);
  font-size: 1rem;
  color: var(--bt-text-muted);
  margin: 4px 0 0;
}

/* —— Bento Grid 统计卡 —— */
.stat-row {
  margin-bottom: 24px;
}
.stat-card {
  background: var(--bt-bg-card);
  border: 1px solid var(--bt-border);
  border-radius: var(--bt-radius-lg);
  padding: 20px 20px 16px;
  transition: all 0.2s ease;
  cursor: default;
  position: relative;
  overflow: hidden;
}
.stat-card::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: transparent;
  transition: opacity 0.2s ease;
  opacity: 0;
}
.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--bt-shadow-card-hover);
}
.stat-card:hover::after {
  opacity: 1;
}
.stat-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.stat-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 12px;
}
.stat-trend {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
}
.trend-up {
  background: #dcfce7;
  color: #16a34a;
}
.trend-down {
  background: #fee2e2;
  color: #dc2626;
}
.stat-value {
  font-family: var(--bt-font-display);
  font-size: 2.25rem;
  font-weight: 700;
  color: var(--bt-text-title);
  line-height: 1.2;
}
.stat-label {
  font-size: 0.875rem;
  color: var(--bt-text-muted);
  margin-top: 4px;
}

/* —— 项目卡片 —— */
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.section-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--bt-text-title);
  margin: 0;
  letter-spacing: -0.01em;
}
.project-row {
  margin-bottom: 8px;
}
.project-card {
  border-radius: var(--bt-radius-lg);
  cursor: pointer;
  margin-bottom: 16px;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.project-card:hover {
  transform: translateY(-3px);
}
.project-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.project-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 14px;
}
.project-name {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--bt-text-title);
  letter-spacing: -0.01em;
  margin-bottom: 4px;
}
.project-desc {
  font-size: 0.875rem;
  color: var(--bt-text-muted);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin-bottom: 16px;
}
.project-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.project-members {
  display: flex;
  align-items: center;
}
.member-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  color: #fff;
  border: 2px solid #fff;
  margin-left: -8px;
  flex-shrink: 0;
}
.member-avatar:first-child {
  margin-left: 0;
}
.project-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}
.project-date {
  font-size: 0.75rem;
  color: var(--bt-text-muted);
}

/* —— 最近动态 —— */
.activity-card {
  border-radius: var(--bt-radius-lg);
}
.activity-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 8px;
  transition: background 0.15s ease;
}
.activity-item:hover {
  background: #f8fafc;
  margin: 0 -8px;
  padding-left: 24px;
  padding-right: 8px;
}
.activity-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-top: 6px;
  flex-shrink: 0;
}
.activity-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.activity-text {
  font-size: 0.875rem;
  color: var(--bt-text-body);
}
.activity-target {
  font-size: 0.8rem;
  color: var(--bt-text-muted);
}
.activity-time {
  font-size: 0.75rem;
  color: var(--bt-text-muted);
  white-space: nowrap;
  flex-shrink: 0;
}
</style>
