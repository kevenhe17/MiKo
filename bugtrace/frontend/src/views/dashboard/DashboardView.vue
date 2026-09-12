<template>
  <div class="dashboard">
    <!-- Hero 区域：编辑式排版（沿用品牌资产） -->
    <div class="hero">
      <p class="greeting">工作台</p>
      <h1 class="hero-title">你好，{{ userStore.user?.realname ?? '用户' }}</h1>
      <p class="hero-subtitle">今天是 {{ today }}，以下是项目概览</p>
    </div>

    <!-- 统计卡：4 张独立 Bento 卡片（保留原品牌卡片语言） -->
    <a-skeleton v-if="loading" active :paragraph="{ rows: 3 }" class="stat-skeleton" />
    <div v-else class="stat-grid">
      <div v-for="stat in stats" :key="stat.label" class="stat-card">
        <div class="stat-top">
          <span class="stat-icon" :style="{ background: stat.iconBg, color: stat.iconColor }">
            <component :is="stat.icon" />
          </span>
          <span
            v-if="stat.trend !== 0"
            class="stat-trend"
            :class="stat.trend > 0 ? 'trend-up' : 'trend-down'"
          >
            <ArrowUpOutlined v-if="stat.trend > 0" />
            <ArrowDownOutlined v-else />
            {{ Math.abs(stat.trend) }}%
          </span>
        </div>
        <a-statistic :value="stat.value" :value-style="STAT_VALUE_STYLE" />
        <div class="stat-label">{{ stat.label }}</div>
      </div>
    </div>

    <!-- 最近项目 -->
    <div class="section-header">
      <h3 class="section-title">最近项目</h3>
      <a-button type="link" class="section-more" @click="$router.push('/projects')">
        查看全部 <RightOutlined />
      </a-button>
    </div>

    <a-skeleton v-if="loading" active :paragraph="{ rows: 4 }" />
    <div v-else-if="projects.length" class="project-grid">
      <a-card
        v-for="project in projects"
        :key="project.id"
        :bordered="false"
        class="project-card"
        @click="$router.push(`/requirements?projectId=${project.id}`)"
      >
        <div class="project-head">
          <div class="project-icon" :style="{ background: project.color }">
            <FolderOutlined />
          </div>
          <a-button type="text" size="small" class="project-more" @click.stop>
            <MoreOutlined />
          </a-button>
        </div>

        <div class="project-name">{{ project.name }}</div>
        <div class="project-desc">{{ project.description || '暂无描述' }}</div>

        <div class="project-foot">
          <!-- 列表接口只返回 members[{userId, role}]，无姓名字段，故展示成员数而非头像组 -->
          <span class="member-count">
            <TeamOutlined />
            {{ project.members.length }} 名成员
          </span>
          <div class="project-meta">
            <a-tag class="code-tag">{{ project.code }}</a-tag>
            <span class="project-date">{{ formatDate(project.createdAt) }}</span>
          </div>
        </div>
      </a-card>
    </div>
    <a-empty v-else description="暂无项目" />

    <!-- 最近动态：时间轴比纯圆点列表更能表达时序 -->
    <div class="section-header section-header--gap">
      <h3 class="section-title">最近动态</h3>
    </div>
    <a-card :bordered="false" class="activity-card">
      <a-skeleton v-if="loading" active :paragraph="{ rows: 4 }" />
      <a-timeline v-else-if="activities.length" class="activity-timeline">
        <a-timeline-item v-for="item in activities" :key="item.id" :color="item.color">
          <div class="act-line">
            <b>{{ item.actor }}</b> {{ item.action }}
            <span class="act-target">{{ item.target }}</span>
          </div>
          <div class="act-time">{{ formatTime(item.createdAt) }}</div>
        </a-timeline-item>
      </a-timeline>
      <a-empty v-else description="暂无动态" :image="Empty.PRESENTED_IMAGE_SIMPLE" />
    </a-card>
  </div>
</template>

<script setup lang="ts">
// v0.2 · 迁移到 Ant Design Vue：Card/Statistic/Skeleton/Timeline/AvatarGroup/Tag/Empty
import { computed, onMounted, ref, markRaw } from 'vue';
import {
  FolderOutlined,
  FileTextOutlined,
  BugOutlined,
  CalendarOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  MoreOutlined,
  RightOutlined,
  TeamOutlined,
} from '@ant-design/icons-vue';
import { Empty } from 'ant-design-vue';
import { useUserStore } from '../../stores/user';
import { listProjects, type Project } from '../../api/project';
import { listBugs, type Bug as BugType } from '../../api/bug';
import { listRequirements, type Requirement } from '../../api/requirement';
import { listPlans, type TestPlan } from '../../api/test-plan';
import { listChanges, type ChangeRequest } from '../../api/change';

const userStore = useUserStore();
const loading = ref(true);

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

/** 指标数字排版：衬线字体 + 等宽数字，保证多列对齐 */
const STAT_VALUE_STYLE = {
  fontFamily: "var(--bt-font-display)",
  fontSize: '2.25rem',
  fontWeight: 700,
  lineHeight: '1.2',
  color: 'var(--bt-text-title)',
  fontVariantNumeric: 'tabular-nums',
} as const;

const stats = computed(() => [
  {
    label: '项目总数',
    value: projects.value.length,
    trend: 0,
    icon: markRaw(FolderOutlined),
    iconBg: '#dbeafe',
    iconColor: '#2563eb',
  },
  {
    label: '需求总数',
    value: requirements.value.total ?? requirements.value.length,
    trend: 0,
    icon: markRaw(FileTextOutlined),
    iconBg: '#dcfce7',
    iconColor: '#16a34a',
  },
  {
    label: '缺陷总数',
    value: bugs.value.total ?? bugs.value.length,
    trend: 12,
    icon: markRaw(BugOutlined),
    iconBg: '#fee2e2',
    iconColor: '#dc2626',
  },
  {
    label: '测试计划',
    value: plans.value.total ?? plans.value.length,
    trend: 0,
    icon: markRaw(CalendarOutlined),
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
};

async function loadAll() {
  try {
    const [pRes, rRes, bRes, plRes, cRes] = await Promise.all([
      listProjects({ page: 1, pageSize: 6 }),
      // 不传 projectId 表示统计全部项目（传 0 会被后端当作过滤条件，恒为 0）
      listRequirements({ page: 1, pageSize: 5 }),
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
  } finally {
    loading.value = false;
  }
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
  margin-bottom: 28px;
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

/* —— 统计卡：4 张独立 Bento 卡片 —— */
.stat-skeleton {
  margin-bottom: 32px;
}
.stat-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 32px;
}
.stat-card {
  padding: 20px 20px 16px;
  background: var(--bt-bg-card);
  border: 1px solid var(--bt-border);
  border-radius: var(--bt-radius-lg);
  transition:
    transform 0.2s cubic-bezier(0.25, 1, 0.5, 1),
    box-shadow 0.2s cubic-bezier(0.25, 1, 0.5, 1);
  /* 点击 / 触摸不留任何颜色痕迹 */
  -webkit-tap-highlight-color: transparent;
}
/* 悬停反馈只对真正的鼠标设备生效：触屏与触控笔会把 hover「粘住」，
   导致卡片上残留高亮，必须用媒体查询隔离 */
@media (hover: hover) and (pointer: fine) {
  .stat-card:hover {
    transform: translateY(-2px);
    box-shadow: var(--bt-shadow-card-hover);
  }
}
/* 卡片本身不可聚焦、无点击行为，显式清掉可能残留的焦点框 */
.stat-card:focus,
.stat-card:focus-visible {
  outline: none;
}
.stat-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.stat-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 12px;
  font-size: 20px;
  flex-shrink: 0;
}
.stat-card :deep(.ant-statistic-content) {
  line-height: 1.2;
}
.stat-label {
  font-size: 0.875rem;
  color: var(--bt-text-muted);
  margin-top: 4px;
}
.stat-trend {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
  white-space: nowrap;
}
.trend-up {
  background: #dcfce7;
  color: #16a34a;
}
.trend-down {
  background: #fee2e2;
  color: #dc2626;
}

/* —— 区块标题 —— */
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
}
.section-header--gap {
  margin-top: 32px;
}
.section-title {
  font-size: 1.0625rem;
  font-weight: 600;
  color: var(--bt-text-title);
  margin: 0;
  letter-spacing: -0.01em;
}
.section-more {
  padding: 0;
  height: auto;
}

/* —— 项目卡片 —— */
.project-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}
.project-card {
  border-radius: var(--bt-radius-lg);
  cursor: pointer;
  transition: transform 0.2s cubic-bezier(0.25, 1, 0.5, 1), box-shadow 0.2s cubic-bezier(0.25, 1, 0.5, 1);
  -webkit-tap-highlight-color: transparent;
}
@media (hover: hover) and (pointer: fine) {
  .project-card:hover {
    transform: translateY(-3px);
    box-shadow: var(--bt-shadow-card-hover);
  }
}
.project-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.project-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 13px;
  color: #fff;
  font-size: 20px;
}
.project-more {
  color: var(--bt-text-muted);
}
.project-name {
  font-size: 1.0625rem;
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
  min-height: 21px;
}
.project-foot {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}
.member-count {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 0.8125rem;
  color: var(--bt-text-muted);
  white-space: nowrap;
}
.project-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.code-tag {
  margin-inline-end: 0;
  font-size: 11px;
  line-height: 18px;
}
.project-date {
  font-size: 0.75rem;
  color: var(--bt-text-muted);
  white-space: nowrap;
}

/* —— 最近动态时间轴 —— */
.activity-card {
  border-radius: var(--bt-radius-lg);
}
.activity-timeline {
  padding-top: 4px;
}
.act-line {
  font-size: 0.875rem;
  color: var(--bt-text-body);
  line-height: 1.5;
}
.act-target {
  color: var(--bt-text-muted);
  margin-left: 4px;
}
.act-time {
  font-size: 0.75rem;
  color: var(--bt-text-muted);
  margin-top: 2px;
}

/* —— 响应式：统计卡降为两列 / 单列 —— */
@media (max-width: 1100px) {
  .stat-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
@media (max-width: 560px) {
  .stat-grid {
    grid-template-columns: 1fr;
  }
}
</style>
