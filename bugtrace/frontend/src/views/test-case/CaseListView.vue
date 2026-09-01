<template>
  <div>
    <div class="bt-toolbar">
      <div>
        <h3 class="bt-page-title">测试用例</h3>
        <p class="bt-page-sub">设计测试用例，关联需求沉淀测试资产</p>
      </div>
      <div class="bt-actions">
        <el-select v-model="filterProjectId" placeholder="项目" clearable style="width: 180px" @change="onFilter">
          <el-option v-for="p in projects" :key="p.id" :label="p.code" :value="Number(p.id)" />
        </el-select>
        <el-input v-model="filterModule" placeholder="模块名" clearable style="width: 140px" @change="onFilter" />
        <el-select v-model="filterPriority" placeholder="优先级" clearable style="width: 110px" @change="onFilter">
          <el-option label="P0" value="P0" />
          <el-option label="P1" value="P1" />
          <el-option label="P2" value="P2" />
        </el-select>
        <el-button v-if="canWrite" type="primary" @click="openForm()">新建用例</el-button>
      </div>
    </div>

    <el-card class="bt-list-card" shadow="never">
      <el-table v-loading="loading" :data="list" stripe>
        <el-table-column label="优先级" width="90">
          <template #default="{ row }">
            <el-tag :type="priorityTag(row.priority)" effect="dark">{{ row.priority ?? 'P1' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="module" label="模块" width="120" />
        <el-table-column prop="title" label="标题" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">
            <el-link type="primary" @click="router.push(`/cases/${row.id}`)">{{ row.title }}</el-link>
          </template>
        </el-table-column>
        <el-table-column label="关联需求" width="170">
          <template #default="{ row }">
            <span v-if="row.requirement">{{ row.requirement.code }}</span>
            <span v-else class="dim">—</span>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" width="170">
          <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column v-if="canWrite" label="操作" width="140">
          <template #default="{ row }">
            <el-button link type="primary" @click="openForm(row)">编辑</el-button>
            <el-button link type="danger" @click="confirmDelete(row)">删除</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无用例" />
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

    <!-- 创建/编辑共用表单弹窗 -->
    <el-dialog v-model="formVisible" :title="editing ? '编辑用例' : '新建用例'" width="620px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="90px">
        <el-form-item label="所属项目" prop="projectId">
          <el-select v-model="form.projectId" :disabled="!!editing" style="width: 100%">
            <el-option v-for="p in projects" :key="p.id" :label="`${p.name}（${p.code}）`" :value="Number(p.id)" />
          </el-select>
        </el-form-item>
        <el-form-item label="模块" prop="module">
          <el-input v-model="form.module" placeholder="如：登录模块" />
        </el-form-item>
        <el-form-item label="标题" prop="title">
          <el-input v-model="form.title" />
        </el-form-item>
        <el-form-item label="优先级" prop="priority">
          <el-radio-group v-model="form.priority">
            <el-radio value="P0">P0</el-radio>
            <el-radio value="P1">P1</el-radio>
            <el-radio value="P2">P2</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="前置条件">
          <el-input v-model="form.precond" type="textarea" :rows="2" placeholder="可选" />
        </el-form-item>
        <el-form-item label="操作步骤" prop="steps">
          <el-input v-model="form.steps" type="textarea" :rows="4" placeholder="每行一步" />
        </el-form-item>
        <el-form-item label="期望结果" prop="expected">
          <el-input v-model="form.expected" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="formVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
// T2-3 · 用例列表页：筛选 + 彩色徽标 + 创建/编辑共用表单 + 删除二次确认
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus';
import { listCases, createCase, updateCase, deleteCase, type TestCase } from '../../api/test-case';
import { listProjects, type Project } from '../../api/project';
import { useUserStore } from '../../stores/user';
import { can } from '../../constants/permission.const';

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
const formRef = ref<FormInstance>();
const form = reactive({
  projectId: undefined as number | undefined,
  module: '',
  title: '',
  precond: '',
  steps: '',
  expected: '',
  priority: 'P1',
});
const rules: FormRules = {
  projectId: [{ required: true, message: '请选择所属项目', trigger: 'change' }],
  module: [{ required: true, message: '请输入模块', trigger: 'blur' }],
  title: [{ required: true, message: '请输入标题', trigger: 'blur' }],
  steps: [{ required: true, message: '请输入操作步骤', trigger: 'blur' }],
  expected: [{ required: true, message: '请输入期望结果', trigger: 'blur' }],
};

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
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;
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
      ElMessage.success('用例已更新');
    } else {
      await createCase(form as never);
      ElMessage.success('用例已创建');
    }
    formVisible.value = false;
    await load();
  } catch {
    // 拦截器统一提示
  } finally {
    submitting.value = false;
  }
}

async function confirmDelete(row: TestCase) {
  const ok = await ElMessageBox.confirm(`确定删除用例「${row.title}」？该操作不可恢复。`, '删除确认', {
    type: 'warning',
  }).catch(() => false);
  if (!ok) return;
  await deleteCase(row.id);
  ElMessage.success('已删除');
  await load();
}

function priorityTag(priority?: string) {
  if (priority === 'P0') return 'danger';
  if (priority === 'P1') return 'warning';
  return 'info';
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
.dim { color: #c0c4cc; }
</style>
