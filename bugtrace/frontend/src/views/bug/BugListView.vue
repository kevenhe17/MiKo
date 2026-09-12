<template>
  <div>
    <div class="bt-toolbar">
      <div>
        <h3 class="bt-page-title">缺陷列表</h3>
        <p class="bt-page-sub">跟踪缺陷从提交到关闭的全生命周期</p>
      </div>
      <div class="bt-actions">
        <a-select
          v-model:value="filterStatus"
          placeholder="按状态筛选"
          allow-clear
          style="width: 150px"
          :options="statusOptions"
          @change="onFilter"
        />
        <a-select
          v-model:value="filterSeverity"
          placeholder="按严重度筛选"
          allow-clear
          style="width: 150px"
          :options="severityOptions"
          @change="onFilter"
        />
        <!-- DEV 视角：服务端已限定只看分派/修复给自己的 Bug，处理人筛选禁用 -->
        <a-select
          v-model:value="filterOwnerId"
          placeholder="按处理人筛选"
          allow-clear
          :disabled="isDev"
          style="width: 180px"
          :options="userOptions"
          @change="onFilter"
        />
        <a-button v-if="canCreate" type="primary" @click="router.push('/bugs/new')">
          <template #icon><PlusOutlined /></template>
          提交缺陷
        </a-button>
      </div>
    </div>

    <a-card :bordered="false" class="bt-list-card">
      <a-table
        :columns="columns"
        :data-source="list"
        :loading="loading"
        :pagination="pagination"
        :custom-row="customRow"
        row-key="id"
        size="middle"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'code'">
            <span class="cell-code">{{ record.code }}</span>
          </template>

          <template v-else-if="column.key === 'title'">
            <div class="cell-primary">{{ record.title }}</div>
          </template>

          <template v-else-if="column.key === 'severity'">
            <a-tag :color="SEVERITY_BADGE[record.severity]?.color">
              {{ SEVERITY_LABELS[record.severity] }}
            </a-tag>
          </template>

          <template v-else-if="column.key === 'status'">
            <a-tag :color="STATUS_BADGE[record.status]?.color">
              {{ STATUS_LABELS[record.status] }}
            </a-tag>
          </template>

          <template v-else-if="column.key === 'owner'">
            <span class="cell-desc">
              {{ record.owner ? record.owner.realname || record.owner.username : '-' }}
            </span>
          </template>

          <template v-else-if="column.key === 'module'">
            <span class="cell-desc">{{ record.module || '-' }}</span>
          </template>

          <template v-else-if="column.key === 'updatedAt'">
            <span class="cell-time">{{ formatTime(record.updatedAt) }}</span>
          </template>
        </template>

        <template #emptyText>
          <a-empty description="暂无 Bug" :image="Empty.PRESENTED_IMAGE_SIMPLE" />
        </template>
      </a-table>
    </a-card>
  </div>
</template>

<script setup lang="ts">
// v0.2 · 迁移到 Ant Design Vue：Table（支持整行点击）/ Select / Tag
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import type { TableColumnsType } from 'ant-design-vue';
import { Empty } from 'ant-design-vue';
import { PlusOutlined } from '@ant-design/icons-vue';
import { listBugs, type Bug } from '../../api/bug';
import { listUsers, type UserOption } from '../../api/user';
import { useUserStore } from '../../stores/user';
import { can } from '../../constants/permission.const';

const router = useRouter();
const userStore = useUserStore();
const isDev = computed(() => userStore.user?.role === 'DEV');
const canCreate = computed(() => can(userStore.user?.role, 'BUG_CREATE'));

const STATUS_LABELS: Record<string, string> = {
  NEW: '新建',
  ASSIGNED: '已分派',
  IN_PROGRESS: '处理中',
  FIXED: '已修复',
  VERIFIED: '已验证',
  CLOSED: '已关闭',
};

const SEVERITY_LABELS: Record<string, string> = {
  BLOCKER: '致命',
  CRITICAL: '严重',
  MAJOR: '一般',
  MINOR: '轻微',
};

// severity 徽标：BLOCKER 红 / CRITICAL 橙 / MAJOR 黄 / MINOR 灰
const SEVERITY_BADGE: Record<string, { color: string }> = {
  BLOCKER: { color: '#F56C6C' },
  CRITICAL: { color: '#E6711B' },
  MAJOR: { color: '#E6A23C' },
  MINOR: { color: '#909399' },
};

// status 徽标按 6 状态配色（内置色板不足以区分 FIXED/VERIFIED，用自定义色）
const STATUS_BADGE: Record<string, { color: string }> = {
  NEW: { color: '#909399' },
  ASSIGNED: { color: '#409EFF' },
  IN_PROGRESS: { color: '#E6A23C' },
  FIXED: { color: '#13C2C2' },
  VERIFIED: { color: '#67C23A' },
  CLOSED: { color: '#606266' },
};

const loading = ref(false);
const list = ref<Bug[]>([]);
const users = ref<UserOption[]>([]);
const filterStatus = ref<string | undefined>(undefined);
const filterSeverity = ref<string | undefined>(undefined);
const filterOwnerId = ref<number | undefined>(undefined);
const page = ref(1);
const pageSize = 10;
const total = ref(0);

const columns: TableColumnsType = [
  { title: 'Code', key: 'code', width: 210 },
  { title: '标题', key: 'title', width: 280 },
  { title: '严重度', key: 'severity', width: 120 },
  { title: '状态', key: 'status', width: 120 },
  { title: '处理人', key: 'owner', width: 130 },
  { title: '模块', key: 'module', width: 140 },
  { title: '更新时间', key: 'updatedAt', width: 200 },
];

const pagination = computed(() => ({
  current: page.value,
  pageSize,
  total: total.value,
  showSizeChanger: false,
  showTotal: (t: number) => `共 ${t} 条`,
  onChange: (p: number) => {
    page.value = p;
    void load();
  },
}));

const statusOptions = computed(() =>
  Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label })),
);
const severityOptions = computed(() =>
  Object.entries(SEVERITY_LABELS).map(([value, label]) => ({ value, label })),
);
const userOptions = computed(() =>
  users.value.map((u) => ({ label: u.realname || u.username, value: Number(u.id) })),
);

async function load() {
  loading.value = true;
  try {
    const result = await listBugs({
      status: filterStatus.value || undefined,
      severity: filterSeverity.value || undefined,
      ownerId: filterOwnerId.value,
      page: page.value,
      pageSize,
    });
    list.value = result.list;
    total.value = result.total;
  } finally {
    loading.value = false;
  }
}

function onFilter() {
  page.value = 1;
  void load();
}

/** 整行可点击跳转详情 */
function customRow(record: Bug) {
  return {
    style: { cursor: 'pointer' },
    onClick: () => {
      void router.push(`/bugs/${record.id}`);
    },
  };
}

function formatTime(value: string) {
  return new Date(value).toLocaleString('zh-CN', { hour12: false });
}

onMounted(async () => {
  users.value = await listUsers();
  await load();
});
</script>

<style scoped>
/* 缺陷编号：等宽数字，便于纵向比对 */
.cell-code {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  color: var(--bt-text-body);
}
</style>
