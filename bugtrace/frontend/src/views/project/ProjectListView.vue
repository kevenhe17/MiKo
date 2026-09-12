<template>
  <div>
    <div class="bt-toolbar">
      <div>
        <h3 class="bt-page-title">软件管理</h3>
        <p class="bt-page-sub">维护软件与成员，为需求、用例、缺陷提供归属</p>
      </div>
      <div class="bt-actions">
        <a-button v-if="canCreate" type="primary" @click="createVisible = true">
          <template #icon><PlusOutlined /></template>
          创建软件
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
          <!-- 版本号：v0.2 起作为主展示标识 -->
          <template v-if="column.key === 'version'">
            <a-tag color="blue" class="ver-tag">{{ record.version || '未标注' }}</a-tag>
          </template>

          <!-- 软件名称 + 唯一编码（编码降为次要信息） -->
          <template v-else-if="column.key === 'name'">
            <div class="cell-primary">{{ record.name }}</div>
            <div class="cell-sub">{{ record.code }}</div>
          </template>

          <template v-else-if="column.key === 'description'">
            <span class="cell-desc">{{ record.description || '—' }}</span>
          </template>

          <template v-else-if="column.key === 'members'">
            <span class="cell-num">{{ record.members.length }}</span>
          </template>

          <template v-else-if="column.key === 'createdAt'">
            <span class="cell-time">{{ formatTime(record.createdAt) }}</span>
          </template>

          <template v-else-if="column.key === 'action'">
            <a-space :size="2">
              <a-button type="link" size="small" @click="openEdit(record)">编辑</a-button>
              <a-button type="link" size="small" @click="openInvite(record)">邀请成员</a-button>
              <a-button type="link" size="small" danger @click="confirmDelete(record)">删除</a-button>
            </a-space>
          </template>
        </template>

        <template #emptyText>
          <a-empty description="暂无软件" :image="Empty.PRESENTED_IMAGE_SIMPLE" />
        </template>
      </a-table>
    </a-card>

    <!-- 创建软件 -->
    <a-modal
      v-model:open="createVisible"
      title="创建软件"
      :confirm-loading="submitting"
      ok-text="创建"
      cancel-text="取消"
      :width="480"
      @ok="submitCreate"
    >
      <a-form ref="createFormRef" :model="createForm" :rules="createRules" layout="vertical" class="dlg-form">
        <a-form-item label="软件编码" name="code" extra="唯一标识，创建后不可修改，如 DEMO">
          <a-input v-model:value="createForm.code" placeholder="如 DEMO" />
        </a-form-item>
        <a-form-item label="软件名称" name="name">
          <a-input v-model:value="createForm.name" placeholder="如 车载中控" />
        </a-form-item>
        <a-form-item label="版本号" name="version">
          <a-input v-model:value="createForm.version" placeholder="如 V1.0.0" />
        </a-form-item>
        <a-form-item label="描述" name="description">
          <a-textarea v-model:value="createForm.description" :rows="3" placeholder="选填" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 编辑软件 -->
    <a-modal
      v-model:open="editVisible"
      title="编辑软件"
      :confirm-loading="submitting"
      ok-text="保存"
      cancel-text="取消"
      :width="480"
      @ok="submitEdit"
    >
      <a-form ref="editFormRef" :model="editForm" :rules="editRules" layout="vertical" class="dlg-form">
        <a-form-item label="软件编码">
          <a-input :value="editTarget?.code" disabled />
        </a-form-item>
        <a-form-item label="软件名称" name="name">
          <a-input v-model:value="editForm.name" />
        </a-form-item>
        <a-form-item label="版本号" name="version">
          <a-input v-model:value="editForm.version" placeholder="如 V1.0.0" />
        </a-form-item>
        <a-form-item label="描述" name="description">
          <a-textarea v-model:value="editForm.description" :rows="3" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 成员管理 -->
    <a-modal
      v-model:open="inviteVisible"
      title="成员管理"
      :footer="null"
      :width="560"
    >
      <p class="invite-target">
        软件：<b>{{ inviteTarget?.name }}</b>（{{ inviteTarget?.version || inviteTarget?.code }}）
      </p>

      <a-table
        :columns="memberColumns"
        :data-source="memberList"
        :pagination="false"
        row-key="userId"
        size="small"
        class="member-table"
      >
        <template #emptyText>
          <a-empty description="暂无成员" :image="Empty.PRESENTED_IMAGE_SIMPLE" />
        </template>
      </a-table>

      <a-divider class="invite-divider" />

      <a-space :size="8" class="invite-form" align="end">
        <a-form-item label="用户" class="invite-item">
          <a-select
            v-model:value="inviteForm.userId"
            placeholder="选择用户"
            style="width: 220px"
            :options="userSelectOptions"
            show-search
            option-filter-prop="label"
          />
        </a-form-item>
        <a-form-item label="角色" class="invite-item">
          <a-select v-model:value="inviteForm.role" style="width: 120px" :options="ROLE_OPTIONS" />
        </a-form-item>
        <a-form-item class="invite-item">
          <a-button type="primary" :loading="submitting" @click="submitInvite">邀请</a-button>
        </a-form-item>
      </a-space>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
// v0.2 · 迁移到 Ant Design Vue：Table / Modal / Form / Select / Tag / Space / Divider
// 本页是「列表页范式」样板：后续需求/用例/计划/缺陷列表按此结构套用
import { computed, onMounted, reactive, ref } from 'vue';
import type { TableColumnsType } from 'ant-design-vue';
import { App, Empty } from 'ant-design-vue';
import { PlusOutlined } from '@ant-design/icons-vue';
import {
  listProjects, createProject, updateProject, deleteProject, inviteMember, getProject,
  type Project, type ProjectMember,
} from '../../api/project';
import { listUsers, type UserOption } from '../../api/user';
import { useUserStore } from '../../stores/user';
import { can } from '../../constants/permission.const';

const { message, modal } = App.useApp();

const userStore = useUserStore();
const canCreate = computed(() => can(userStore.user?.role, 'PROJECT_WRITE'));

const loading = ref(false);
const submitting = ref(false);
const list = ref<Project[]>([]);
const page = ref(1);
const pageSize = 10;
const total = ref(0);

// —— 表格列定义 ——
const columns: TableColumnsType = [
  { title: '版本号', key: 'version', width: 140 },
  { title: '软件名称', key: 'name', width: 220 },
  { title: '描述', key: 'description', ellipsis: true },
  { title: '成员数', key: 'members', width: 90, align: 'center' },
  { title: '创建时间', key: 'createdAt', width: 180 },
  { title: '操作', key: 'action', width: 220, fixed: 'right' },
];

const memberColumns: TableColumnsType = [
  { title: '姓名', dataIndex: 'realname', key: 'realname' },
  { title: '账号', dataIndex: 'username', key: 'username' },
  { title: '项目角色', dataIndex: 'role', key: 'role', width: 110 },
];

const ROLE_OPTIONS = [
  { label: 'ADMIN', value: 'ADMIN' },
  { label: 'DEV', value: 'DEV' },
  { label: 'QA', value: 'QA' },
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

// —— 创建 ——
const createVisible = ref(false);
const createFormRef = ref();
const createForm = reactive({ code: '', name: '', version: '', description: '' });
const createRules = {
  code: [
    { required: true, message: '请输入软件编码', trigger: 'blur' },
    { min: 2, max: 32, message: '2-32 个字符', trigger: 'blur' },
  ],
  name: [{ required: true, message: '请输入软件名称', trigger: 'blur' }],
  version: [{ required: true, message: '请输入版本号', trigger: 'blur' }],
};

// —— 编辑 ——
const editVisible = ref(false);
const editFormRef = ref();
const editTarget = ref<Project | null>(null);
const editForm = reactive({ name: '', version: '', description: '' });
const editRules = {
  name: [{ required: true, message: '请输入软件名称', trigger: 'blur' }],
};

// —— 成员 ——
const inviteVisible = ref(false);
const inviteTarget = ref<Project | null>(null);
const memberList = ref<ProjectMember[]>([]);
const userOptions = ref<UserOption[]>([]);
const inviteForm = reactive({ userId: undefined as number | undefined, role: 'DEV' });
const userSelectOptions = computed(() =>
  userOptions.value.map((u) => ({ label: `${u.realname}（${u.username}）`, value: Number(u.id) })),
);

async function load() {
  loading.value = true;
  try {
    const result = await listProjects({ page: page.value, pageSize });
    list.value = result.list;
    total.value = result.total;
  } finally {
    loading.value = false;
  }
}

async function openInvite(project: Project) {
  inviteTarget.value = project;
  inviteForm.userId = undefined;
  inviteForm.role = 'DEV';
  // 拉详情取含用户名的成员列表
  const detail = await getProject(project.id);
  memberList.value = detail.members ?? [];
  inviteVisible.value = true;
}

function openEdit(project: Project) {
  editTarget.value = project;
  editForm.name = project.name;
  editForm.version = project.version ?? '';
  editForm.description = project.description ?? '';
  editVisible.value = true;
}

async function submitEdit() {
  if (!editTarget.value) return;
  try {
    await editFormRef.value?.validate();
  } catch {
    return; // 校验未通过
  }
  submitting.value = true;
  try {
    await updateProject(editTarget.value.id, {
      name: editForm.name,
      version: editForm.version,
      description: editForm.description,
    });
    message.success('软件已更新');
    editVisible.value = false;
    await load();
  } catch {
    // 拦截器统一提示
  } finally {
    submitting.value = false;
  }
}

// —— 删除（仅 ADMIN；服务端校验子数据，存在关联时 400 拒绝） ——
function confirmDelete(project: Project) {
  modal.confirm({
    title: '删除软件',
    content: `确定删除「${project.name}（${project.version || project.code}）」吗？软件下存在需求/用例/计划/缺陷/变更单时将被拒绝。`,
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    async onOk() {
      try {
        await deleteProject(project.id);
        message.success('软件已删除');
        // 删除后若当前页超出总页数则回退一页
        const maxPage = Math.max(1, Math.ceil((total.value - 1) / pageSize));
        if (page.value > maxPage) page.value = maxPage;
        await load();
      } catch {
        // 拦截器统一提示（含子数据被拒原因），此处吞掉避免弹窗悬挂
      }
    },
  });
}

async function submitCreate() {
  try {
    await createFormRef.value?.validate();
  } catch {
    return;
  }
  submitting.value = true;
  try {
    await createProject({
      code: createForm.code,
      name: createForm.name,
      version: createForm.version,
      description: createForm.description,
    });
    message.success('软件创建成功');
    createVisible.value = false;
    createForm.code = '';
    createForm.name = '';
    createForm.version = '';
    createForm.description = '';
    await load();
  } catch {
    // 错误提示由拦截器统一处理（如 code 重复 409）
  } finally {
    submitting.value = false;
  }
}

async function submitInvite() {
  if (!inviteTarget.value || !inviteForm.userId) {
    message.warning('请选择要邀请的用户');
    return;
  }
  submitting.value = true;
  try {
    await inviteMember(inviteTarget.value.id, { userId: inviteForm.userId, role: inviteForm.role });
    message.success('邀请成功');
    await openInvite(inviteTarget.value);
  } catch {
    // 拦截器统一提示
  } finally {
    submitting.value = false;
  }
}

function formatTime(value: string) {
  return new Date(value).toLocaleString('zh-CN', { hour12: false });
}

onMounted(async () => {
  await load();
  if (canCreate.value) {
    userOptions.value = await listUsers();
  }
});
</script>

<style scoped>
/* 列表页范式的公共类（ver-tag / cell-* / dlg-form）已提升到
   styles/index.css 全局，本页只保留页面专属样式。 */

.invite-target {
  margin: 0 0 12px;
  color: var(--bt-text-muted);
  font-size: 13px;
}
.member-table {
  margin-bottom: 4px;
}
.invite-divider {
  margin: 16px 0;
}
.invite-item {
  margin-bottom: 0;
}
</style>
