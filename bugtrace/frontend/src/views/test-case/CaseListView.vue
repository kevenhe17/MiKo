<template>
  <div>
    <div class="bt-toolbar">
      <div>
        <h3 class="bt-page-title">测试用例</h3>
        <p class="bt-page-sub">设计测试用例，关联需求沉淀测试资产</p>
      </div>
      <div class="bt-actions">
        <a-select
          v-model:value="filterProjectId"
          placeholder="项目"
          allow-clear
          style="width: 180px"
          :options="projectOptions"
          @change="onFilter"
        />
        <a-input
          v-model:value="filterModule"
          placeholder="模块名"
          allow-clear
          style="width: 140px"
          @press-enter="onFilter"
          @blur="onFilter"
          @change="onModuleInput"
        />
        <a-select
          v-model:value="filterPriority"
          placeholder="优先级"
          allow-clear
          style="width: 110px"
          :options="PRIORITY_OPTIONS"
          @change="onFilter"
        />
        <a-button v-if="canWrite" type="primary" @click="openForm()">
          <template #icon><PlusOutlined /></template>
          新建用例
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
          <template v-if="column.key === 'priority'">
            <a-tag :color="priorityColor(record.priority)">{{ record.priority ?? 'P1' }}</a-tag>
          </template>

          <template v-else-if="column.key === 'title'">
            <a-button type="link" class="cell-link" @click="router.push(`/cases/${record.id}`)">
              {{ record.title }}
            </a-button>
          </template>

          <template v-else-if="column.key === 'requirement'">
            <span v-if="record.requirement" class="cell-desc">{{ record.requirement.code }}</span>
            <span v-else class="cell-desc">—</span>
          </template>

          <template v-else-if="column.key === 'createdAt'">
            <span class="cell-time">{{ formatTime(record.createdAt) }}</span>
          </template>

          <template v-else-if="column.key === 'action'">
            <a-space :size="2">
              <a-button type="link" size="small" @click="openForm(record)">编辑</a-button>
              <a-button type="link" size="small" danger @click="confirmDelete(record)">删除</a-button>
            </a-space>
          </template>
        </template>

        <template #emptyText>
          <a-empty description="暂无用例" :image="Empty.PRESENTED_IMAGE_SIMPLE" />
        </template>
      </a-table>
    </a-card>

    <!-- 创建/编辑共用表单弹窗 -->
    <a-modal
      v-model:open="formVisible"
      :title="editing ? '编辑用例' : '新建用例'"
      :confirm-loading="submitting"
      ok-text="保存"
      cancel-text="取消"
      :width="620"
      @ok="submit"
    >
      <a-form ref="formRef" :model="form" :rules="rules" layout="vertical" class="dlg-form">
        <a-form-item label="所属项目" name="projectId">
          <a-select
            v-model:value="form.projectId"
            :disabled="!!editing"
            :options="fullProjectOptions"
            placeholder="选择所属项目"
          />
        </a-form-item>

        <a-form-item label="模块" name="module">
          <a-input v-model:value="form.module" placeholder="如：登录模块" />
        </a-form-item>

        <a-form-item label="标题" name="title">
          <a-input v-model:value="form.title" placeholder="用例标题" />
        </a-form-item>

        <a-form-item label="优先级" name="priority">
          <a-radio-group v-model:value="form.priority">
            <a-radio-button value="P0">P0</a-radio-button>
            <a-radio-button value="P1">P1</a-radio-button>
            <a-radio-button value="P2">P2</a-radio-button>
          </a-radio-group>
        </a-form-item>

        <a-form-item label="前置条件" name="precond">
          <a-textarea v-model:value="form.precond" :rows="2" placeholder="可选" />
        </a-form-item>

        <a-form-item label="操作步骤" name="steps">
          <a-textarea v-model:value="form.steps" :rows="4" placeholder="每行一步" />
        </a-form-item>

        <a-form-item label="期望结果" name="expected">
          <a-textarea v-model:value="form.expected" :rows="2" placeholder="期望结果" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
// v0.2 · 迁移到 Ant Design Vue：Table / Modal / Form / Select / Radio / Tag
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import type { TableColumnsType } from 'ant-design-vue';
import { App, Empty } from 'ant-design-vue';
import { PlusOutlined } from '@ant-design/icons-vue';
import { listCases, createCase, updateCase, deleteCase, type TestCase } from '../../api/test-case';
import { listProjects, type Project } from '../../api/project';
import { useUserStore } from '../../stores/user';
import { can } from '../../constants/permission.const';

const { message, modal } = App.useApp();
const router = useRouter();
const userStore = useUserStore();
const canWrite = computed(() => can(userStore.user?.role, 'TEST_CASE_WRITE'));

const loading = ref(false);
const submitting = ref(false);
const list = ref<TestCase[]>([]);
const projects = ref<Project[]>([]);
const page = ref(1);
const pageSize = 10;
const total = ref(0);

const filterProjectId = ref<number | undefined>(undefined);
const filterModule = ref('');
const filterPriority = ref<string | undefined>(undefined);

const formVisible = ref(false);
const editing = ref<TestCase | null>(null);
const formRef = ref();
const form = reactive({
  projectId: undefined as number | undefined,
  module: '',
  title: '',
  precond: '',
  steps: '',
  expected: '',
  priority: 'P1',
});
const rules = {
  projectId: [{ required: true, message: '请选择所属项目', trigger: 'change' }],
  module: [{ required: true, message: '请输入模块', trigger: 'change' }],
  title: [{ required: true, message: '请输入标题', trigger: 'change' }],
  steps: [{ required: true, message: '请输入操作步骤', trigger: 'change' }],
  expected: [{ required: true, message: '请输入期望结果', trigger: 'change' }],
};

const PRIORITY_OPTIONS = [
  { label: 'P0', value: 'P0' },
  { label: 'P1', value: 'P1' },
  { label: 'P2', value: 'P2' },
];

// —— 列定义（操作列按权限动态追加） ——
const columns = computed<TableColumnsType>(() => {
  const cols: TableColumnsType = [
    { title: '优先级', key: 'priority', width: 100 },
    { title: '模块', dataIndex: 'module', key: 'module', width: 140 },
    { title: '标题', key: 'title', width: 280 },
    { title: '关联需求', key: 'requirement', width: 190 },
    { title: '创建时间', key: 'createdAt', width: 200 },
  ];
  if (canWrite.value) {
    cols.push({ title: '操作', key: 'action', width: 140, fixed: 'right' });
  }
  return cols;
});

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

// 筛选条只显示编码，表单里显示「名称（编码）」
const projectOptions = computed(() =>
  projects.value.map((p) => ({ label: p.code, value: Number(p.id) })),
);
const fullProjectOptions = computed(() =>
  projects.value.map((p) => ({ label: `${p.name}（${p.code}）`, value: Number(p.id) })),
);

async function load() {
  loading.value = true;
  try {
    const result = await listCases({
      projectId: filterProjectId.value,
      module: filterModule.value || undefined,
      priority: filterPriority.value,
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

/** 输入框清空时立即刷新（避免每次键入都发请求） */
function onModuleInput(e: Event) {
  if (!(e.target as HTMLInputElement).value) onFilter();
}

function openForm(row?: TestCase) {
  editing.value = row ?? null;
  Object.assign(form, {
    projectId: row ? Number(row.projectId) : undefined,
    module: row?.module ?? '',
    title: row?.title ?? '',
    precond: row?.precond ?? '',
    steps: row?.steps ?? '',
    expected: row?.expected ?? '',
    priority: row?.priority ?? 'P1',
  });
  formVisible.value = true;
}

async function submit() {
  try {
    await formRef.value?.validate();
  } catch {
    return;
  }
  submitting.value = true;
  try {
    if (editing.value) {
      await updateCase(editing.value.id, {
        module: form.module,
        title: form.title,
        precond: form.precond,
        steps: form.steps,
        expected: form.expected,
        priority: form.priority as 'P0' | 'P1' | 'P2',
      });
      message.success('用例已更新');
    } else {
      await createCase(form as never);
      message.success('用例已创建');
    }
    formVisible.value = false;
    await load();
  } catch {
    // 拦截器统一提示
  } finally {
    submitting.value = false;
  }
}

function confirmDelete(row: TestCase) {
  modal.confirm({
    title: '删除确认',
    content: `确定删除用例「${row.title}」？该操作不可恢复。`,
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    async onOk() {
      try {
        await deleteCase(row.id);
        message.success('已删除');
        await load();
      } catch {
        // 拦截器统一提示
      }
    },
  });
}

function priorityColor(priority?: string) {
  if (priority === 'P0') return 'red';
  if (priority === 'P1') return 'orange';
  return 'default';
}

function formatTime(value: string) {
  return new Date(value).toLocaleString('zh-CN', { hour12: false });
}

onMounted(async () => {
  projects.value = (await listProjects({ page: 1, pageSize: 100 })).list;
  await load();
});
</script>

<style scoped>
/* 表格内的名称入口：去按钮内边距，视觉上是链接文字 */
.cell-link {
  padding: 0;
  height: auto;
  font-weight: 600;
}
</style>
