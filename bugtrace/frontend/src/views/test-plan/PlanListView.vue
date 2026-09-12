<template>
  <div>
    <div class="bt-toolbar">
      <div>
        <h3 class="bt-page-title">测试计划</h3>
        <p class="bt-page-sub">组织用例形成可执行的测试计划</p>
      </div>
      <div class="bt-actions">
        <a-select
          v-model:value="filterProjectId"
          placeholder="按项目筛选"
          allow-clear
          style="width: 220px"
          :options="projectOptions"
          @change="onFilter"
        />
        <a-button v-if="canWrite" type="primary" @click="openCreate">
          <template #icon><PlusOutlined /></template>
          创建计划
        </a-button>
      </div>
    </div>

    <a-card :bordered="false" class="bt-list-card">
      <a-table
        :columns="columns"
        :data-source="list"
        :loading="loading"
        :pagination="pagination"
        row-key="id"
        size="middle"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'name'">
            <a-button type="link" class="cell-link" @click="router.push(`/plans/${record.id}`)">
              {{ record.name }}
            </a-button>
          </template>

          <template v-else-if="column.key === 'owner'">
            <span class="cell-desc">{{ record.owner?.realname ?? record.ownerId }}</span>
          </template>

          <template v-else-if="column.key === 'caseCount'">
            <span class="cell-num">{{ record.caseCount ?? 0 }}</span>
          </template>

          <template v-else-if="column.key === 'status'">
            <a-tag color="orange">待执行</a-tag>
          </template>

          <template v-else-if="column.key === 'createdAt'">
            <span class="cell-time">{{ formatTime(record.createdAt) }}</span>
          </template>
        </template>

        <template #emptyText>
          <a-empty description="暂无计划" :image="Empty.PRESENTED_IMAGE_SIMPLE" />
        </template>
      </a-table>
    </a-card>

    <!-- 创建计划 -->
    <a-modal
      v-model:open="createVisible"
      title="创建测试计划"
      :confirm-loading="submitting"
      ok-text="创建"
      cancel-text="取消"
      :width="640"
      @ok="submit"
    >
      <a-form ref="formRef" :model="form" :rules="rules" layout="vertical" class="dlg-form">
        <a-form-item label="所属项目" name="projectId">
          <a-select
            v-model:value="form.projectId"
            :options="projectOptions"
            placeholder="选择所属项目"
            @change="loadProjectCases"
          />
        </a-form-item>

        <a-form-item label="计划名称" name="name">
          <a-input v-model:value="form.name" placeholder="如：V1.0 回归测试计划" />
        </a-form-item>

        <a-form-item label="负责人" name="ownerId">
          <a-select v-model:value="form.ownerId" :options="userOptions" placeholder="选择负责人" />
        </a-form-item>

        <a-form-item label="勾选用例" name="caseIds">
          <a-select
            v-model:value="form.caseIds"
            mode="multiple"
            :options="caseOptions"
            placeholder="先选择项目，再勾选用例"
            :disabled="!form.projectId"
            show-search
            option-filter-prop="label"
          />
          <p v-if="form.caseIds.length" class="picker-summary">
            已选 {{ form.caseIds.length }} 条用例
          </p>
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
// v0.2 · 迁移到 Ant Design Vue：Table / Modal / Form / Select / Tag
// 遵循「列表页范式」（见 ProjectListView）
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import type { TableColumnsType } from 'ant-design-vue';
import { App, Empty } from 'ant-design-vue';
import { PlusOutlined } from '@ant-design/icons-vue';
import { listPlans, createPlan, type TestPlan } from '../../api/test-plan';
import { listProjects, type Project } from '../../api/project';
import { listCases, type TestCase } from '../../api/test-case';
import { listUsers, type UserOption } from '../../api/user';
import { useUserStore } from '../../stores/user';
import { can } from '../../constants/permission.const';

const { message } = App.useApp();
const router = useRouter();
const userStore = useUserStore();
const canWrite = computed(() => can(userStore.user?.role, 'TEST_PLAN_WRITE'));

const loading = ref(false);
const submitting = ref(false);
const list = ref<TestPlan[]>([]);
const projects = ref<Project[]>([]);
const users = ref<UserOption[]>([]);
const filterProjectId = ref<number | undefined>(undefined);
const page = ref(1);
const pageSize = 10;
const total = ref(0);

const createVisible = ref(false);
const formRef = ref();
const projectCases = ref<TestCase[]>([]);
const form = reactive({
  projectId: undefined as number | undefined,
  name: '',
  ownerId: undefined as number | undefined,
  caseIds: [] as number[],
});
const rules = {
  projectId: [{ required: true, message: '请选择所属项目', trigger: 'change' }],
  name: [{ required: true, message: '请输入计划名称', trigger: 'change' }],
  ownerId: [{ required: true, message: '请选择负责人', trigger: 'change' }],
  caseIds: [{ required: true, type: 'array', min: 1, message: '至少勾选一个用例', trigger: 'change' }],
};

// —— 表格列 ——
const columns: TableColumnsType = [
  { title: '计划名称', key: 'name', width: 260 },
  { title: '负责人', key: 'owner', width: 140 },
  { title: '用例数', key: 'caseCount', width: 100, align: 'center' },
  { title: '状态', key: 'status', width: 120 },
  { title: '创建时间', key: 'createdAt', width: 200 },
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

// —— 下拉选项 ——
const projectOptions = computed(() =>
  projects.value.map((p) => ({ label: `${p.name}（${p.code}）`, value: Number(p.id) })),
);
const userOptions = computed(() =>
  users.value.map((u) => ({ label: `${u.realname}（${u.username}）`, value: Number(u.id) })),
);
const caseOptions = computed(() =>
  projectCases.value.map((c) => ({
    label: `[${c.priority ?? 'P1'}] ${c.module} · ${c.title}${
      c.requirement ? `（关联 ${c.requirement.code}）` : ''
    }`,
    value: Number(c.id),
  })),
);

async function load() {
  loading.value = true;
  try {
    const result = await listPlans({
      page: page.value,
      pageSize,
      projectId: filterProjectId.value,
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

function openCreate() {
  Object.assign(form, { projectId: undefined, name: '', ownerId: undefined, caseIds: [] });
  projectCases.value = [];
  createVisible.value = true;
}

async function loadProjectCases() {
  // 切换项目时清空已选用例，避免跨项目残留导致 400
  form.caseIds = [];
  if (!form.projectId) {
    projectCases.value = [];
    return;
  }
  // 拉全量（MVP 规模小，pageSize=100）；关联了需求的用例排序靠前
  const result = await listCases({ projectId: form.projectId, page: 1, pageSize: 100 });
  projectCases.value = [...result.list].sort((a, b) => {
    if (!!a.requirementId === !!b.requirementId) return 0;
    return a.requirementId ? -1 : 1;
  });
}

async function submit() {
  try {
    await formRef.value?.validate();
  } catch {
    return;
  }
  submitting.value = true;
  try {
    await createPlan(form as never);
    message.success('计划创建成功');
    createVisible.value = false;
    await load();
  } catch {
    // 拦截器统一提示（如跨项目用例 400）
  } finally {
    submitting.value = false;
  }
}

function formatTime(value: string) {
  return new Date(value).toLocaleString('zh-CN', { hour12: false });
}

onMounted(async () => {
  projects.value = (await listProjects({ page: 1, pageSize: 100 })).list;
  if (canWrite.value) {
    users.value = await listUsers();
  }
  await load();
});
</script>

<style scoped>
.picker-summary {
  margin: 6px 0 0;
  color: var(--bt-text-muted);
  font-size: 13px;
}
/* 表格内的名称入口：去按钮内边距，视觉上是链接文字 */
.cell-link {
  padding: 0;
  height: auto;
  font-weight: 600;
}
</style>
