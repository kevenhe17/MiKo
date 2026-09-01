<template>
  <div v-if="plan">
    <div class="bt-toolbar">
      <div>
        <h3 class="bt-page-title">{{ plan.name }}</h3>
        <p class="bt-page-sub">{{ plan.project?.code }} · 计划详情</p>
      </div>
      <el-button @click="router.back()">返回</el-button>
    </div>

    <el-card shadow="never" class="mb16">
      <el-descriptions :column="2" border>
        <el-descriptions-item label="计划名称" :span="2">{{ plan.name }}</el-descriptions-item>
        <el-descriptions-item label="负责人">{{ plan.owner?.realname ?? plan.ownerId }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag type="warning">待执行</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="用例数">{{ plan.caseCount }}</el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ formatTime(plan.createdAt) }}</el-descriptions-item>
      </el-descriptions>
    </el-card>

    <el-card shadow="never" class="bt-list-card">
      <template #header>用例明细（{{ plan.cases.length }}）</template>
      <el-table :data="plan.cases" stripe size="small">
        <el-table-column label="优先级" width="80">
          <template #default="{ row }">
            <el-tag :type="row.priority === 'P0' ? 'danger' : row.priority === 'P1' ? 'warning' : 'info'" effect="dark">
              {{ row.priority ?? 'P1' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="module" label="模块" width="120" />
        <el-table-column prop="title" label="标题" min-width="200" show-overflow-tooltip />
        <el-table-column label="关联需求" width="160">
          <template #default="{ row }">{{ row.requirement?.code ?? '—' }}</template>
        </el-table-column>
        <el-table-column label="期望结果" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">{{ row.expected }}</template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无用例" />
        </template>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
// T2-4 · 计划详情页（只读）
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { getPlan, type TestPlanDetail } from '../../api/test-plan';

const route = useRoute();
const router = useRouter();
const plan = ref<TestPlanDetail | null>(null);

function formatTime(value: string) {
  return new Date(value).toLocaleString('zh-CN', { hour12: false });
}

onMounted(async () => {
  plan.value = await getPlan(route.params.id as string);
});
</script>

<style scoped>
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.code { margin-left: 8px; color: #6b7684; }
.section-title { margin: 20px 0 8px; }
</style>
