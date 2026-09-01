<template>
  <div>
    <div class="bt-toolbar">
      <div>
        <h3 class="bt-page-title">项目管理</h3>
        <p class="bt-page-sub">维护项目与成员，为需求、用例、缺陷提供归属</p>
      </div>
      <div class="bt-actions">
        <el-button v-if="canCreate" type="primary" @click="createVisible = true">创建项目</el-button>
      </div>
    </div>

    <el-card class="bt-list-card" shadow="never">
      <el-table v-loading="loading" :data="list" stripe>
        <el-table-column prop="code" label="Code" width="140" />
        <el-table-column prop="name" label="项目名称" min-width="160" />
        <el-table-column prop="description" label="描述" min-width="180" show-overflow-tooltip />
        <el-table-column label="成员数" width="80">
          <template #default="{ row }">{{ row.members.length }}</template>
        </el-table-column>
        <el-table-column label="创建时间" width="170">
          <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column v-if="canCreate" label="操作" width="220">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button link type="primary" @click="openInvite(row)">邀请成员</el-button>
            <el-button link type="danger" @click="confirmDelete(row)">删除</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无项目" />
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

    <!-- 编辑项目弹窗 -->
    <el-dialog v-model="editVisible" title="编辑项目" width="460px">
      <el-form ref="editFormRef" :model="editForm" :rules="editRules" label-width="90px">
        <el-form-item label="Code">
          <el-input :model-value="editTarget?.code" disabled />
        </el-form-item>
        <el-form-item label="项目名称" prop="name">
          <el-input v-model="editForm.name" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="editForm.description" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitEdit">保存</el-button>
      </template>
    </el-dialog>

    <!-- 创建项目弹窗 -->
    <el-dialog v-model="createVisible" title="创建项目" width="460px">
      <el-form ref="createFormRef" :model="createForm" :rules="createRules" label-width="90px">
        <el-form-item label="Code" prop="code">
          <el-input v-model="createForm.code" placeholder="如 DEMO" />
        </el-form-item>
        <el-form-item label="项目名称" prop="name">
          <el-input v-model="createForm.name" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="createForm.description" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitCreate">创建</el-button>
      </template>
    </el-dialog>

    <!-- 成员邀请弹窗 -->
    <el-dialog v-model="inviteVisible" title="邀请成员" width="460px">
      <p class="invite-target">项目：{{ inviteTarget?.name }}（{{ inviteTarget?.code }}）</p>
      <el-table v-if="inviteTarget" :data="memberList" border size="small" class="member-table">
        <el-table-column prop="realname" label="姓名" />
        <el-table-column prop="username" label="账号" />
        <el-table-column prop="role" label="项目角色" width="100" />
      </el-table>
      <el-divider />
      <el-form :inline="true">
        <el-form-item label="用户">
          <el-select v-model="inviteForm.userId" placeholder="选择用户" style="width: 200px">
            <el-option
              v-for="u in userOptions"
              :key="u.id"
              :label="`${u.realname}（${u.username}）`"
              :value="Number(u.id)"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="角色">
          <el-select v-model="inviteForm.role" style="width: 120px">
            <el-option label="ADMIN" value="ADMIN" />
            <el-option label="DEV" value="DEV" />
            <el-option label="QA" value="QA" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="submitting" @click="submitInvite">邀请</el-button>
        </el-form-item>
      </el-form>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
// T1-5 · 项目列表页：创建/成员邀请两个弹窗；写入口仅 ADMIN 可见
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus';
import { listProjects, createProject, updateProject, deleteProject, inviteMember, getProject, type Project, type ProjectMember } from '../../api/project';
import { listUsers, type UserOption } from '../../api/user';
import { useUserStore } from '../../stores/user';
import { can } from '../../constants/permission.const';

const userStore = useUserStore();
const canCreate = computed(() => can(userStore.user?.role, 'PROJECT_WRITE'));

const loading = ref(false);
const submitting = ref(false);
const list = ref<Project[]>([]);
const page = ref(1);
const pageSize = 10;
const total = ref(0);

const createVisible = ref(false);
const createFormRef = ref<FormInstance>();
const createForm = reactive({ code: '', name: '', description: '' });
const createRules: FormRules = {
  code: [
    { required: true, message: '请输入项目 code', trigger: 'blur' },
    { min: 2, max: 32, message: '2-32 个字符', trigger: 'blur' },
  ],
  name: [{ required: true, message: '请输入项目名称', trigger: 'blur' }],
};

const inviteVisible = ref(false);
const inviteTarget = ref<Project | null>(null);
const memberList = ref<ProjectMember[]>([]);
const userOptions = ref<UserOption[]>([]);
const inviteForm = reactive({ userId: undefined as number | undefined, role: 'DEV' });

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

// —— 编辑（仅 ADMIN；code 为系统标识不可改） ——
const editVisible = ref(false);
const editFormRef = ref<FormInstance>();
const editTarget = ref<Project | null>(null);
const editForm = reactive({ name: '', description: '' });
const editRules: FormRules = {
  name: [{ required: true, message: '请输入项目名称', trigger: 'blur' }],
};

function openEdit(project: Project) {
  editTarget.value = project;
  editForm.name = project.name;
  editForm.description = project.description ?? '';
  editVisible.value = true;
}

async function submitEdit() {
  if (!editTarget.value) return;
  const valid = await editFormRef.value?.validate().catch(() => false);
  if (!valid) return;
  submitting.value = true;
  try {
    await updateProject(editTarget.value.id, {
      name: editForm.name,
      description: editForm.description,
    });
    ElMessage.success('项目已更新');
    editVisible.value = false;
    await load();
  } catch {
    // 拦截器统一提示
  } finally {
    submitting.value = false;
  }
}

// —— 删除（仅 ADMIN；服务端校验子数据，存在关联时 400 拒绝） ——
async function confirmDelete(project: Project) {
  try {
    await ElMessageBox.confirm(
      `确定删除项目「${project.name}（${project.code}）」吗？项目下存在需求/用例/计划/缺陷/变更单时将被拒绝。`,
      '删除项目',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' },
    );
  } catch {
    return; // 用户取消
  }
  try {
    await deleteProject(project.id);
    ElMessage.success('项目已删除');
    // 删除后若当前页超出总页数则回退一页
    const maxPage = Math.max(1, Math.ceil((total.value - 1) / pageSize));
    if (page.value > maxPage) page.value = maxPage;
    await load();
  } catch {
    // 拦截器统一提示（含子数据被拒原因）
  }
}

async function submitCreate() {
  const valid = await createFormRef.value?.validate().catch(() => false);
  if (!valid) return;
  submitting.value = true;
  try {
    await createProject(createForm);
    ElMessage.success('项目创建成功');
    createVisible.value = false;
    createForm.code = '';
    createForm.name = '';
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
    ElMessage.warning('请选择要邀请的用户');
    return;
  }
  submitting.value = true;
  try {
    await inviteMember(inviteTarget.value.id, { userId: inviteForm.userId, role: inviteForm.role });
    ElMessage.success('邀请成功');
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
.invite-target { margin: 0 0 8px; color: var(--bt-text-muted); font-size: 13px; }
.member-table { margin-bottom: 4px; }
</style>
