<template>
  <div>
    <div class="bt-toolbar">
      <div>
        <h3 class="bt-page-title">缺陷列表</h3>
        <p class="bt-page-sub">跟踪缺陷从提交到关闭的全生命周期</p>
      </div>
      <div class="bt-actions">
        <el-select v-model="filterStatus" placeholder="按状态筛选" clearable style="width: 150px" @change="onFilter">
          <el-option v-for="(label, key) in STATUS_LABELS" :key="key" :label="label" :value="key" />
        </el-select>
        <el-select v-model="filterSeverity" placeholder="按严重度筛选" clearable style="width: 150px" @change="onFilter">
          <el-option v-for="(label, key) in SEVERITY_LABELS" :key="key" :label="label" :value="key" />
        </el-select>
        <!-- DEV 视角：服务端已限定只看分派/修复给自己的 Bug，处理人筛选禁用 -->
        <el-select
          v-model="filterOwnerId"
          placeholder="按处理人筛选"
          clearable
          :disabled="isDev"
          style="width: 180px"
          @change="onFilter"
        >
          <el-option v-for="u in users" :key="u.id" :label="u.realname || u.username" :value="Number(u.id)" />
        </el-select>
        <el-button v-if="canCreate" type="primary" @click="router.push('/bugs/new')">提交缺陷</el-button>
      </div>
    </div>

    <el-card class="bt-list-card" shadow="never">
      <el-table
        v-loading="loading"
        :data="list"
        stripe
        row-class-name="clickable-row"
        @row-click="goDetail"
      >
        <el-table-column prop="code" label="Code" width="190" />
        <el-table-column prop="title" label="标题" min-width="200" show-overflow-tooltip />
        <el-table-column label="严重度" width="110">
          <template #default="{ row }">
            <el-tag :color="SEVERITY_BADGE[row.severity]?.color" :style="{ color: '#fff', border: 'none' }">
              {{ SEVERITY_LABELS[row.severity] }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <el-tag :color="STATUS_BADGE[row.status]?.color" :style="{ color: '#fff', border: 'none' }">
              {{ STATUS_LABELS[row.status] }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="处理人" width="110">
          <template #default="{ row }">
            {{ row.owner ? row.owner.realname || row.owner.username : '-' }}
          </template>
        </el-table-column>
        <el-table-column label="模块" width="120">
          <template #default="{ row }">{{ row.module || '-' }}</template>
        </el-table-column>
        <el-table-column label="更新时间" width="170">
          <template #default="{ row }">{{ formatTime(row.updatedAt) }}</template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无 Bug" />
        </template>
      </el-table>

      <div class="bt-pager">
        <el-pagination
          v-model:current-page="page"
          :page-size="pageSize"
          :total="total"
          layout="total, prev, pager, next"
          @current-change="load"
        />
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
// T3-4 · Bug 列表页：状态/严重度/处理人筛选 + 分页 + 彩色徽标 + 行点击跳详情
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
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

// status 徽标按 6 状态配色（内置 type 不足以区分 FIXED/VERIFIED，用自定义色）
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
const filterStatus = ref<string>('');
const filterSeverity = ref<string>('');
const filterOwnerId = ref<number | undefined>(undefined);
const page = ref(1);
const pageSize = 10;
const total = ref(0);

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

function goDetail(row: Bug) {
  void router.push(`/bugs/${row.id}`);
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
:deep(.clickable-row) { cursor: pointer; }
</style>
