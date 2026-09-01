<template>
  <div v-if="testCase" class="case-detail">
    <div class="bt-toolbar">
      <div>
        <h3 class="bt-page-title">{{ testCase.title }}</h3>
        <p class="bt-page-sub">{{ testCase.project?.code }} · 用例详情</p>
      </div>
      <div class="bt-actions">
        <el-button @click="router.back()">返回</el-button>
        <el-button v-if="canWrite" type="danger" @click="confirmDelete">删除用例</el-button>
      </div>
    </div>

    <el-card shadow="never">
      <el-descriptions :column="2" border>
        <el-descriptions-item label="标题" :span="2">{{ testCase.title }}</el-descriptions-item>
        <el-descriptions-item label="模块">{{ testCase.module }}</el-descriptions-item>
        <el-descriptions-item label="优先级">
          <el-tag :type="priorityTag(testCase.priority)" effect="dark">{{ testCase.priority ?? 'P1' }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="前置条件" :span="2">{{ testCase.precond || '—' }}</el-descriptions-item>
        <el-descriptions-item label="操作步骤" :span="2">
          <pre class="multiline">{{ testCase.steps }}</pre>
        </el-descriptions-item>
        <el-descriptions-item label="期望结果" :span="2">
          <pre class="multiline">{{ testCase.expected }}</pre>
        </el-descriptions-item>
        <el-descriptions-item label="关联需求" :span="2">
          <div class="requirement-row">
            <template v-if="canWrite">
              <el-select
                v-model="selectedRequirementId"
                placeholder="选择需求（可清除）"
                clearable
                style="width: 360px"
                :loading="requirementsLoading"
              >
                <el-option
                  v-for="r in requirements"
                  :key="r.id"
                  :label="`${r.code} · ${r.title}`"
                  :value="Number(r.id)"
                />
              </el-select>
              <el-button type="primary" style="margin-left: 8px" @click="saveLink">保存关联</el-button>
            </template>
            <span v-else-if="testCase.requirement">{{ testCase.requirement.code }} · {{ testCase.requirement.title }}</span>
            <span v-else class="dim">未关联</span>
          </div>
        </el-descriptions-item>
      </el-descriptions>
    </el-card>
  </div>
</template>

<script setup lang="ts">
// T2-3 · 用例详情页：只读展示 + 关联需求选择器（保存即调接口）+ 删除
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { getCase, linkRequirement, deleteCase, type TestCase } from '../../api/test-case';
import { listRequirements, type Requirement } from '../../api/requirement';
import { useUserStore } from '../../stores/user';
import { can } from '../../constants/permission.const';

const route = useRoute();
const router = useRouter();
const userStore = useUserStore();
const canWrite = computed(() => can(userStore.user?.role, 'TEST_CASE_WRITE'));

const testCase = ref<TestCase | null>(null);
const requirements = ref<Requirement[]>([]);
const requirementsLoading = ref(false);
const selectedRequirementId = ref<number | undefined>(undefined);

async function load() {
  testCase.value = await getCase(route.params.id as string);
  selectedRequirementId.value = testCase.value.requirementId
    ? Number(testCase.value.requirementId)
    : undefined;
}

async function loadRequirements() {
  if (!testCase.value) return;
  requirementsLoading.value = true;
  try {
    const result = await listRequirements({
      projectId: Number(testCase.value.projectId),
      page: 1,
      pageSize: 100,
    });
    requirements.value = result.list;
  } finally {
    requirementsLoading.value = false;
  }
}

async function saveLink() {
  if (!testCase.value) return;
  await linkRequirement(testCase.value.id, selectedRequirementId.value ?? null);
  ElMessage.success(selectedRequirementId.value ? '关联已保存' : '已清除关联');
  await load();
}

async function confirmDelete() {
  if (!testCase.value) return;
  const ok = await ElMessageBox.confirm(`确定删除用例「${testCase.value.title}」？该操作不可恢复。`, '删除确认', {
    type: 'warning',
  }).catch(() => false);
  if (!ok) return;
  await deleteCase(testCase.value.id);
  ElMessage.success('已删除');
  router.back();
}

function priorityTag(priority?: string) {
  if (priority === 'P0') return 'danger';
  if (priority === 'P1') return 'warning';
  return 'info';
}

watch(() => route.params.id, () => void load());

onMounted(async () => {
  await load();
  await loadRequirements();
});
</script>

<style scoped>
.multiline {
  margin: 0;
  white-space: pre-wrap;
  font-family: inherit;
  background: var(--bt-gradient-soft);
  padding: 10px 12px;
  border-radius: var(--bt-radius-sm);
}
.requirement-row { display: flex; align-items: center; }
.dim { color: #c0c4cc; }
</style>
