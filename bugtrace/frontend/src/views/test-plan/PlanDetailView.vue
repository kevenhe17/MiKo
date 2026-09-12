<template>
  <div v-if="plan">
    <div class="bt-toolbar">
      <div>
        <h3 class="bt-page-title">{{ plan.name }}</h3>
        <p class="bt-page-sub">{{ plan.project?.code }} · 计划详情</p>
      </div>
      <a-button @click="router.back()">返回</a-button>
    </div>

    <a-card :bordered="false" class="detail-card">
      <a-descriptions :column="2" bordered size="middle">
        <a-descriptions-item label="计划名称" :span="2">{{ plan.name }}</a-descriptions-item>
        <a-descriptions-item label="负责人">
          {{ plan.owner?.realname ?? plan.ownerId }}
        </a-descriptions-item>
        <a-descriptions-item label="状态">
          <a-tag color="orange">待执行</a-tag>
        </a-descriptions-item>
        <a-descriptions-item label="用例数">
          <span class="cell-num">{{ plan.caseCount }}</span>
        </a-descriptions-item>
        <a-descriptions-item label="创建时间">
          <span class="cell-time">{{ formatTime(plan.createdAt) }}</span>
        </a-descriptions-item>
      </a-descriptions>
    </a-card>

    <a-card :bordered="false" class="bt-list-card">
      <template #title>用例明细（{{ plan.cases.length }}）</template>

      <a-table
        :columns="columns"
        :data-source="plan.cases"
        :pagination="false"
        row-key="id"
        size="small"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'priority'">
            <a-tag :color="priorityColor(record.priority)">{{ record.priority ?? 'P1' }}</a-tag>
          </template>

          <template v-else-if="column.key === 'requirement'">
            <span class="cell-desc">{{ record.requirement?.code ?? '—' }}</span>
          </template>
        </template>

        <template #emptyText>
          <a-empty description="暂无用例" :image="Empty.PRESENTED_IMAGE_SIMPLE" />
        </template>
      </a-table>
    </a-card>
  </div>
</template>

<script setup lang="ts">
// v0.2 · 迁移到 Ant Design Vue：Descriptions / Card / Table / Tag
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { TableColumnsType } from 'ant-design-vue';
import { Empty } from 'ant-design-vue';
import { getPlan, type TestPlanDetail } from '../../api/test-plan';

const route = useRoute();
const router = useRouter();
const plan = ref<TestPlanDetail | null>(null);

const columns: TableColumnsType = [
  { title: '优先级', key: 'priority', width: 90 },
  { title: '模块', dataIndex: 'module', key: 'module', width: 140 },
  { title: '标题', dataIndex: 'title', key: 'title', ellipsis: true },
  { title: '关联需求', key: 'requirement', width: 180 },
  { title: '期望结果', dataIndex: 'expected', key: 'expected', ellipsis: true },
];

/** 优先级 → antd tag 色板（P0 红 / P1 橙 / 其余灰） */
function priorityColor(priority?: string) {
  if (priority === 'P0') return 'red';
  if (priority === 'P1') return 'orange';
  return 'default';
}

function formatTime(value: string) {
  return new Date(value).toLocaleString('zh-CN', { hour12: false });
}

onMounted(async () => {
  plan.value = await getPlan(route.params.id as string);
});
</script>

<style scoped>
.detail-card {
  margin-bottom: 16px;
}
/* 带标题的卡片：表头留白与主标题字重 */
.bt-list-card :deep(.ant-card-head) {
  padding: 0 20px;
  min-height: 52px;
  font-weight: 600;
  color: var(--bt-text-title);
}
</style>
