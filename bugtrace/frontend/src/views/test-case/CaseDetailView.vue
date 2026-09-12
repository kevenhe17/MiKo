<template>
  <div v-if="testCase" class="case-detail">
    <div class="bt-toolbar">
      <div>
        <h3 class="bt-page-title">{{ testCase.title }}</h3>
        <p class="bt-page-sub">{{ testCase.project?.code }} · 用例详情</p>
      </div>
      <div class="bt-actions">
        <a-button @click="router.back()">返回</a-button>
        <a-button v-if="canWrite" danger @click="confirmDelete">删除用例</a-button>
      </div>
    </div>

    <a-card :bordered="false">
      <a-descriptions :column="2" bordered size="middle">
        <a-descriptions-item label="标题" :span="2">{{ testCase.title }}</a-descriptions-item>
        <a-descriptions-item label="模块">{{ testCase.module }}</a-descriptions-item>
        <a-descriptions-item label="优先级">
          <a-tag :color="priorityColor(testCase.priority)">{{ testCase.priority ?? 'P1' }}</a-tag>
        </a-descriptions-item>
        <a-descriptions-item label="前置条件" :span="2">
          {{ testCase.precond || '—' }}
        </a-descriptions-item>
        <a-descriptions-item label="操作步骤" :span="2">
          <pre class="multiline">{{ testCase.steps }}</pre>
        </a-descriptions-item>
        <a-descriptions-item label="期望结果" :span="2">
          <pre class="multiline">{{ testCase.expected }}</pre>
        </a-descriptions-item>
        <a-descriptions-item label="关联需求" :span="2">
          <div class="requirement-row">
            <template v-if="canWrite">
              <a-select
                v-model:value="selectedRequirementId"
                placeholder="选择需求（可清除）"
                allow-clear
                style="width: 360px"
                :loading="requirementsLoading"
                :options="requirementOptions"
              />
              <a-button type="primary" @click="saveLink">保存关联</a-button>
            </template>
            <span v-else-if="testCase.requirement">
              {{ testCase.requirement.code }} · {{ testCase.requirement.title }}
            </span>
            <span v-else class="cell-desc">未关联</span>
          </div>
        </a-descriptions-item>
      </a-descriptions>
    </a-card>
  </div>
</template>

<script setup lang="ts">
// v0.2 · 迁移到 Ant Design Vue：Descriptions / Card / Select / Tag / Button
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { App } from 'ant-design-vue';
import { getCase, linkRequirement, deleteCase, type TestCase } from '../../api/test-case';
import { listRequirements, type Requirement } from '../../api/requirement';
import { useUserStore } from '../../stores/user';
import { can } from '../../constants/permission.const';

const { message, modal } = App.useApp();
const route = useRoute();
const router = useRouter();
const userStore = useUserStore();
const canWrite = computed(() => can(userStore.user?.role, 'TEST_CASE_WRITE'));

const testCase = ref<TestCase | null>(null);
const requirements = ref<Requirement[]>([]);
const requirementsLoading = ref(false);
const selectedRequirementId = ref<number | undefined>(undefined);

const requirementOptions = computed(() =>
  requirements.value.map((r) => ({
    label: `${r.code} · ${r.title}`,
    value: Number(r.id),
  })),
);

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
  try {
    await linkRequirement(testCase.value.id, selectedRequirementId.value ?? null);
    message.success(selectedRequirementId.value ? '关联已保存' : '已清除关联');
    await load();
  } catch {
    // 拦截器统一提示
  }
}

function confirmDelete() {
  if (!testCase.value) return;
  modal.confirm({
    title: '删除确认',
    content: `确定删除用例「${testCase.value.title}」？该操作不可恢复。`,
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    async onOk() {
      try {
        await deleteCase(testCase.value!.id);
        message.success('已删除');
        router.back();
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
.requirement-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
