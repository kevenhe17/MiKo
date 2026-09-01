<template>
  <div>
    <div class="bt-toolbar">
      <div>
        <h3 class="bt-page-title">测试计划</h3>
        <p class="bt-page-sub">组织用例形成可执行的测试计划</p>
      </div>
      <div class="bt-actions">
        <el-select v-model="filterProjectId" placeholder="按项目筛选" clearable style="width: 220px" @change="onFilter">
          <el-option v-for="p in projects" :key="p.id" :label="`${p.name}（${p.code}）`" :value="Number(p.id)" />
        </el-select>
        <el-button v-if="canWrite" type="primary" @click="openCreate">创建计划</el-button>
      </div>
    </div>

    <el-card class="bt-list-card" shadow="never">
      <el-table v-loading="loading" :data="list" stripe>
        <el-table-column prop="name" label="计划名称" min-width="200">
          <template #default="{ row }">
            <el-link type="primary" @click="router.push(`/plans/${row.id}`)">{{ row.name }}</el-link>
          </template>
        </el-table-column>
        <el-table-column label="负责人" width="120">
          <template #default="{ row }">{{ row.owner?.realname ?? row.ownerId }}</template>
        </el-table-column>
        <el-table-column label="用例数" width="90">
          <template #default="{ row }">{{ row.caseCount ?? 0 }}</template>
        </el-table-column>
        <el-table-column label="状态" width="110">
          <template #default>
            <el-tag type="warning">待执行</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" width="170">
          <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无计划" />
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

    <!-- 创建计划弹窗 -->
    <el-dialog v-model="createVisible" title="创建测试计划" width="640px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="90px">
        <el-form-item label="所属项目" prop="projectId">
          <el-select v-model="form.projectId" style="width: 100%" @change="loadProjectCases">
            <el-option v-for="p in projects" :key="p.id" :label="`${p.name}（${p.code}）`" :value="Number(p.id)" />
          </el-select>
        </el-form-item>
        <el-form-item label="计划名称" prop="name">
          <el-input v-model="form.name" placeholder="如：V1.0 回归测试计划" />
        </el-form-item>
        <el-form-item label="负责人" prop="ownerId">
          <el-select v-model="form.ownerId" style="width: 100%">
            <el-option v-for="u in users" :key="u.id" :label="`${u.realname}（${u.username}）`" :value="Number(u.id)" />
          </el-select>
        </el-form-item>
        <el-form-item label="勾选用例" prop="caseIds">
          <div class="case-picker">
            <el-select
              v-model="form.caseIds"
              multiple
              filterable
              placeholder="先选择项目，再勾选用例"
              style="width: 100%"
              :disabled="!form.projectId"
            >
              <el-option
                v-for="c in projectCases"
                :key="c.id"
                :label="`[${c.priority ?? 'P1'}] ${c.module} · ${c.title}${c.requirement ? `（关联 ${c.requirement.code}）` : ''}`"
                :value="Number(c.id)"
              />
            </el-select>
            <p v-if="form.caseIds.length" class="picker-summary">
              已选 {{ form.caseIds.length }} 条用例
            </p>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submit">创建</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
// T2-4 · 计划列表页：创建表单（负责人下拉 + 用例多选 + 已选数量汇总）
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, type FormInstance, type FormRules } from 'element-plus';
import { listPlans, createPlan, type TestPlan } from '../../api/test-plan';
import { listProjects, type Project } from '../../api/project';
import { listCases, type TestCase } from '../../api/test-case';
import { listUsers, type UserOption } from '../../api/user';
import { useUserStore } from '../../stores/user';
import { can } from '../../constants/permission.const';

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
const formRef = ref<FormInstance>();
const projectCases = ref<TestCase[]>([]);
const form = reactive({
  projectId: undefined as number | undefined,
  name: '',
  ownerId: undefined as number | undefined,
  caseIds: [] as number[],
});
const rules: FormRules = {
  projectId: [{ required: true, message: '请选择所属项目', trigger: 'change' }],
  name: [{ required: true, message: '请输入计划名称', trigger: 'blur' }],
  ownerId: [{ required: true, message: '请选择负责人', trigger: 'change' }],
  caseIds: [{ required: true, type: 'array', min: 1, message: '至少勾选一个用例', trigger: 'change' }],
};

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
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;
  submitting.value = true;
  try {
    await createPlan(form as never);
    ElMessage.success('计划创建成功');
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
.case-picker { width: 100%; }
.picker-summary { margin: 6px 0 0; color: var(--bt-text-muted); font-size: 13px; }
</style>
