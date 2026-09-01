<template>
  <div>
    <div class="bt-toolbar">
      <div>
        <h3 class="bt-page-title">需求管理</h3>
        <p class="bt-page-sub">登记与跟踪产品需求</p>
      </div>
      <div class="bt-actions">
        <el-select v-model="filterProjectId" placeholder="按项目筛选" clearable style="width: 220px" @change="onFilter">
          <el-option v-for="p in projects" :key="p.id" :label="`${p.name}（${p.code}）`" :value="Number(p.id)" />
        </el-select>
        <el-button v-if="canCreate" type="primary" @click="createVisible = true">登记需求</el-button>
      </div>
    </div>

    <el-card class="bt-list-card" shadow="never">
      <el-table v-loading="loading" :data="list" stripe>
        <el-table-column prop="code" label="Code" width="150" />
        <el-table-column prop="title" label="标题" min-width="180" show-overflow-tooltip />
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="row.status === 'OPEN' ? 'success' : 'info'">
              {{ row.status === 'OPEN' ? '开放' : '关闭' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="所属项目" width="130">
          <template #default="{ row }">{{ projectLabel(row.projectId) }}</template>
        </el-table-column>
        <el-table-column label="创建时间" width="170">
          <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column v-if="canCreate" label="操作" width="130">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button link type="danger" @click="confirmDelete(row)">删除</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无需求" />
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

    <!-- 编辑需求弹窗 -->
    <el-dialog v-model="editVisible" title="编辑需求" width="480px">
      <el-form ref="editFormRef" :model="editForm" :rules="editRules" label-width="90px">
        <el-form-item label="Code">
          <el-input :model-value="editTarget?.code" disabled />
        </el-form-item>
        <el-form-item label="所属项目">
          <el-input :model-value="projectLabel(editTarget?.projectId ?? '')" disabled />
        </el-form-item>
        <el-form-item label="标题" prop="title">
          <el-input v-model="editForm.title" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="editForm.description" type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="editForm.status">
            <el-radio-button value="OPEN">开放</el-radio-button>
            <el-radio-button value="CLOSED">关闭</el-radio-button>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitEdit">保存</el-button>
      </template>
    </el-dialog>

    <!-- 登记需求弹窗 -->
    <el-dialog v-model="createVisible" title="登记需求" width="480px">
      <el-form ref="createFormRef" :model="createForm" :rules="createRules" label-width="90px">
        <el-form-item label="所属项目" prop="projectId">
          <el-select v-model="createForm.projectId" placeholder="选择项目" style="width: 100%">
            <el-option v-for="p in projects" :key="p.id" :label="`${p.name}（${p.code}）`" :value="Number(p.id)" />
          </el-select>
        </el-form-item>
        <el-form-item label="标题" prop="title">
          <el-input v-model="createForm.title" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="createForm.description" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitCreate">提交</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
// T1-5 · 需求列表页：code/title/status 展示 + 按项目筛选 + 登记弹窗（仅 ADMIN）
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus';
import { listRequirements, createRequirement, updateRequirement, deleteRequirement, type Requirement } from '../../api/requirement';
import { listProjects, type Project } from '../../api/project';
import { useUserStore } from '../../stores/user';
import { can } from '../../constants/permission.const';

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
const createFormRef = ref<FormInstance>();
const createForm = reactive({ projectId: undefined as number | undefined, title: '', description: '' });
const createRules: FormRules = {
  projectId: [{ required: true, message: '请选择所属项目', trigger: 'change' }],
  title: [{ required: true, message: '请输入需求标题', trigger: 'blur' }],
};

async function load() {
  loading.value = true;
  try {
    const result = await listRequirements({
      projectId: filterProjectId.value ?? 0,
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
  const valid = await createFormRef.value?.validate().catch(() => false);
  if (!valid) return;
  submitting.value = true;
  try {
    const created = await createRequirement(createForm as { projectId: number; title: string });
    ElMessage.success(`登记成功：${created.code}`);
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
const editVisible = ref(false);
const editFormRef = ref<FormInstance>();
const editTarget = ref<Requirement | null>(null);
const editForm = reactive({
  title: '',
  description: '',
  status: 'OPEN' as 'OPEN' | 'CLOSED',
});
const editRules: FormRules = {
  title: [{ required: true, message: '请输入需求标题', trigger: 'blur' }],
};

function openEdit(row: Requirement) {
  editTarget.value = row;
  editForm.title = row.title;
  editForm.description = row.description ?? '';
  editForm.status = row.status;
  editVisible.value = true;
}

async function submitEdit() {
  if (!editTarget.value) return;
  const valid = await editFormRef.value?.validate().catch(() => false);
  if (!valid) return;
  submitting.value = true;
  try {
    await updateRequirement(editTarget.value.id, {
      title: editForm.title,
      description: editForm.description,
      status: editForm.status,
    });
    ElMessage.success('需求已更新');
    editVisible.value = false;
    await load();
  } catch {
    // 拦截器统一提示
  } finally {
    submitting.value = false;
  }
}

// —— 删除（仅 ADMIN；服务端校验引用，被用例/Bug/变更单引用时 400 拒绝） ——
async function confirmDelete(row: Requirement) {
  try {
    await ElMessageBox.confirm(
      `确定删除需求「${row.code} · ${row.title}」吗？被用例/缺陷/变更单引用时将被拒绝。`,
      '删除需求',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' },
    );
  } catch {
    return; // 用户取消
  }
  try {
    await deleteRequirement(row.id);
    ElMessage.success('需求已删除');
    const maxPage = Math.max(1, Math.ceil((total.value - 1) / pageSize));
    if (page.value > maxPage) page.value = maxPage;
    await load();
  } catch {
    // 拦截器统一提示（含被引用拒绝原因）
  }
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
