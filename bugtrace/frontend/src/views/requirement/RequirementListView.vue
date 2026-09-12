<template>
  <div>
    <div class="bt-toolbar">
      <div>
        <h3 class="bt-page-title">需求管理</h3>
        <p class="bt-page-sub">登记与跟踪产品需求</p>
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
        <a-button v-if="canCreate" type="primary" @click="createVisible = true">
          <template #icon><PlusOutlined /></template>
          登记需求
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
          <template v-if="column.key === 'code'">
            <a-tag color="blue" class="ver-tag">{{ record.code }}</a-tag>
          </template>

          <template v-else-if="column.key === 'title'">
            <div class="cell-primary">{{ record.title }}</div>
          </template>

          <template v-else-if="column.key === 'status'">
            <a-tag :color="record.status === 'OPEN' ? 'green' : 'default'">
              {{ record.status === 'OPEN' ? '开放' : '关闭' }}
            </a-tag>
          </template>

          <template v-else-if="column.key === 'project'">
            <span class="cell-desc">{{ projectLabel(record.projectId) }}</span>
          </template>

          <template v-else-if="column.key === 'createdAt'">
            <span class="cell-time">{{ formatTime(record.createdAt) }}</span>
          </template>

          <template v-else-if="column.key === 'action'">
            <a-space :size="2">
              <a-button type="link" size="small" @click="openEdit(record)">编辑</a-button>
              <a-button type="link" size="small" danger @click="confirmDelete(record)">删除</a-button>
            </a-space>
          </template>
        </template>

        <template #emptyText>
          <a-empty description="暂无需求" :image="Empty.PRESENTED_IMAGE_SIMPLE" />
        </template>
      </a-table>
    </a-card>

    <!-- 编辑需求 -->
    <a-modal
      v-model:open="editVisible"
      title="编辑需求"
      :confirm-loading="submitting"
      ok-text="保存"
      cancel-text="取消"
      :width="480"
      @ok="submitEdit"
    >
      <a-form ref="editFormRef" :model="editForm" :rules="editRules" layout="vertical" class="dlg-form">
        <a-form-item label="Code">
          <a-input :value="editTarget?.code" disabled />
        </a-form-item>
        <a-form-item label="所属项目">
          <a-input :value="projectLabel(editTarget?.projectId ?? '')" disabled />
        </a-form-item>
        <a-form-item label="标题" name="title">
          <a-input v-model:value="editForm.title" />
        </a-form-item>
        <a-form-item label="描述" name="description">
          <a-textarea v-model:value="editForm.description" :rows="3" />
        </a-form-item>
        <a-form-item label="状态">
          <a-radio-group v-model:value="editForm.status">
            <a-radio-button value="OPEN">开放</a-radio-button>
            <a-radio-button value="CLOSED">关闭</a-radio-button>
          </a-radio-group>
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 登记需求 -->
    <a-modal
      v-model:open="createVisible"
      title="登记需求"
      :confirm-loading="submitting"
      ok-text="提交"
      cancel-text="取消"
      :width="480"
      @ok="submitCreate"
    >
      <a-form ref="createFormRef" :model="createForm" :rules="createRules" layout="vertical" class="dlg-form">
        <a-form-item label="所属项目" name="projectId">
          <a-select
            v-model:value="createForm.projectId"
            placeholder="选择项目"
            :options="projectOptions"
          />
        </a-form-item>
        <a-form-item label="标题" name="title">
          <a-input v-model:value="createForm.title" placeholder="需求标题" />
        </a-form-item>
        <a-form-item label="描述" name="description">
          <a-textarea v-model:value="createForm.description" :rows="3" placeholder="选填" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
// v0.2 · 迁移到 Ant Design Vue：Table / Modal / Form / Select / Radio / Tag
import { computed, onMounted, reactive, ref } from 'vue';
import type { TableColumnsType } from 'ant-design-vue';
import { App, Empty } from 'ant-design-vue';
import { PlusOutlined } from '@ant-design/icons-vue';
import { listRequirements, createRequirement, updateRequirement, deleteRequirement, type Requirement } from '../../api/requirement';
import { listProjects, type Project } from '../../api/project';
import { useUserStore } from '../../stores/user';
import { can } from '../../constants/permission.const';

const { message, modal } = App.useApp();
const userStore = useUserStore();
const canCreate = computed(() => can(userStore.user?.role, 'REQUIREMENT_WRITE'));

const loading = ref(false);
const submitting = ref(false);
const list = ref<Requirement[]>([]);
const projects = ref<Project[]>([]);
const filterProjectId = ref<number | undefined>(undefined);
const page = ref(1);
const pageSize = 10;
const total = ref(0);

const createVisible = ref(false);
const createFormRef = ref();
const createForm = reactive({ projectId: undefined as number | undefined, title: '', description: '' });
const createRules = {
  projectId: [{ required: true, message: '请选择所属项目', trigger: 'change' }],
  title: [{ required: true, message: '请输入需求标题', trigger: 'change' }],
};

const editVisible = ref(false);
const editFormRef = ref();
const editTarget = ref<Requirement | null>(null);
const editForm = reactive({
  title: '',
  description: '',
  status: 'OPEN' as 'OPEN' | 'CLOSED',
});
const editRules = {
  title: [{ required: true, message: '请输入需求标题', trigger: 'change' }],
};

// —— 列定义 ——
const columns = computed<TableColumnsType>(() => {
  const cols: TableColumnsType = [
    { title: 'Code', key: 'code', width: 170 },
    { title: '标题', key: 'title', width: 300 },
    { title: '状态', key: 'status', width: 110 },
    { title: '所属项目', key: 'project', width: 150 },
    { title: '创建时间', key: 'createdAt', width: 200 },
  ];
  if (canCreate.value) {
    cols.push({ title: '操作', key: 'action', width: 150, fixed: 'right' });
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

const projectOptions = computed(() =>
  projects.value.map((p) => ({ label: `${p.name}（${p.code}）`, value: Number(p.id) })),
);

async function load() {
  loading.value = true;
  try {
    const result = await listRequirements({
      // 未选择项目时不传 projectId，表示查全部
      projectId: filterProjectId.value,
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

async function submitCreate() {
  try {
    await createFormRef.value?.validate();
  } catch {
    return;
  }
  submitting.value = true;
  try {
    const created = await createRequirement(createForm as { projectId: number; title: string });
    message.success(`登记成功：${created.code}`);
    createVisible.value = false;
    createForm.title = '';
    createForm.description = '';
    await load();
  } catch {
    // 拦截器统一提示
  } finally {
    submitting.value = false;
  }
}

// —— 编辑（仅 ADMIN；code 与所属项目不可改） ——
function openEdit(row: Requirement) {
  editTarget.value = row;
  editForm.title = row.title;
  editForm.description = row.description ?? '';
  editForm.status = row.status;
  editVisible.value = true;
}

async function submitEdit() {
  if (!editTarget.value) return;
  try {
    await editFormRef.value?.validate();
  } catch {
    return;
  }
  submitting.value = true;
  try {
    await updateRequirement(editTarget.value.id, {
      title: editForm.title,
      description: editForm.description,
      status: editForm.status,
    });
    message.success('需求已更新');
    editVisible.value = false;
    await load();
  } catch {
    // 拦截器统一提示
  } finally {
    submitting.value = false;
  }
}

// —— 删除（仅 ADMIN；服务端校验引用，被用例/Bug/变更单引用时 400 拒绝） ——
function confirmDelete(row: Requirement) {
  modal.confirm({
    title: '删除需求',
    content: `确定删除需求「${row.code} · ${row.title}」吗？被用例/缺陷/变更单引用时将被拒绝。`,
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    async onOk() {
      try {
        await deleteRequirement(row.id);
        message.success('需求已删除');
        // 删除后若当前页超出总页数则回退一页
        const maxPage = Math.max(1, Math.ceil((total.value - 1) / pageSize));
        if (page.value > maxPage) page.value = maxPage;
        await load();
      } catch {
        // 拦截器统一提示（含被引用拒绝原因），此处吞掉避免弹窗悬挂
      }
    },
  });
}

function projectLabel(projectId: string) {
  const p = projects.value.find((item) => item.id === projectId);
  return p ? `${p.code}` : projectId;
}

function formatTime(value: string) {
  return new Date(value).toLocaleString('zh-CN', { hour12: false });
}

onMounted(async () => {
  projects.value = (await listProjects({ page: 1, pageSize: 100 })).list;
  await load();
});
</script>
