<template>
  <div class="change-view">
    <div class="bt-toolbar">
      <div>
        <h3 class="bt-page-title">变更流转</h3>
        <p class="bt-page-sub">主干 / 分支软件变更 · 状态机驱动的流转与度量</p>
      </div>
      <div class="bt-actions">
        <el-select v-model="projectId" placeholder="选择项目" style="width: 220px" @change="reloadAll">
          <el-option v-for="p in projects" :key="p.id" :label="`${p.name}（${p.code}）`" :value="Number(p.id)" />
        </el-select>
        <el-button type="primary" @click="createDialog = true">新建变更单</el-button>
      </div>
    </div>

    <!-- KPI 指标卡片 -->
    <el-row :gutter="12" class="kpi-row">
      <el-col :span="5" v-for="kpi in kpiCards" :key="kpi.label">
        <el-card shadow="never" class="kpi-card">
          <div class="kpi-value" :style="{ color: kpi.color }">{{ kpi.value }}</div>
          <div class="kpi-label">{{ kpi.label }}</div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 图表区：状态分布 + 流转趋势 -->
    <el-row :gutter="12" class="chart-row">
      <el-col :span="9">
        <el-card shadow="never" class="chart-card">
          <template #header>状态分布</template>
          <div ref="statusChartEl" class="chart"></div>
        </el-card>
      </el-col>
      <el-col :span="15">
        <el-card shadow="never" class="chart-card">
          <template #header>近 14 天流转趋势</template>
          <div ref="trendChartEl" class="chart"></div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 待回流清单 -->
    <el-card v-if="backflows.length > 0" shadow="never" class="mb16 backflow-card">
      <template #header>
        待回流清单（{{ backflows.length }}）<el-tag type="danger" size="small" effect="dark" style="margin-left: 8px">需关注</el-tag>
      </template>
      <el-table :data="backflows" size="small">
        <el-table-column prop="code" label="编号" width="150" />
        <el-table-column prop="title" label="标题" min-width="200" show-overflow-tooltip />
        <el-table-column label="类型" width="90">
          <template #default="{ row }">
            <el-tag :type="typeTag(row.type)" size="small">{{ row.type }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="分支" min-width="180">
          <template #default="{ row }">
            <code class="branch-code">{{ row.srcBranch }}</code> → <code class="branch-code">{{ row.dstBranch }}</code>
          </template>
        </el-table-column>
        <el-table-column prop="owner.realname" label="负责人" width="90" />
        <el-table-column width="100">
          <template #default="{ row }">
            <el-button size="small" type="success" plain @click="onBackflowDone(row)">标记已回流</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- CR 列表 -->
    <el-card shadow="never" class="bt-list-card">
      <template #header>变更单列表</template>
      <div class="list-filter">
        <el-select v-model="filterStatus" placeholder="状态筛选" clearable style="width: 150px" @change="loadList(1)">
          <el-option v-for="(label, s) in STATUS_LABELS" :key="s" :label="label" :value="s" />
        </el-select>
        <el-select v-model="filterType" placeholder="类型筛选" clearable style="width: 130px" @change="loadList(1)">
          <el-option v-for="t in TYPE_OPTIONS" :key="t" :label="t" :value="t" />
        </el-select>
      </div>
      <el-table :data="crs" stripe>
        <el-table-column prop="code" label="编号" width="150">
          <template #default="{ row }">
            <el-link type="primary" @click="openDetail(row)">{{ row.code }}</el-link>
          </template>
        </el-table-column>
        <el-table-column prop="title" label="标题" min-width="220" show-overflow-tooltip />
        <el-table-column label="类型" width="100">
          <template #default="{ row }">
            <el-tag :type="typeTag(row.type)" size="small" effect="dark">{{ row.type }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="风险" width="80">
          <template #default="{ row }">
            <el-tag :type="riskTag(row.riskLevel)" size="small">{{ row.riskLevel }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <el-tag :type="statusTag(row.status)" size="small" effect="light">{{ STATUS_LABELS[row.status] ?? row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="分支流向" min-width="200">
          <template #default="{ row }">
            <code class="branch-code">{{ row.srcBranch }}</code> → <code class="branch-code">{{ row.dstBranch }}</code>
          </template>
        </el-table-column>
        <el-table-column prop="owner.realname" label="负责人" width="90" />
        <el-table-column label="更新时间" width="150">
          <template #default="{ row }">{{ formatTime(row.updatedAt) }}</template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无变更单" />
        </template>
      </el-table>
      <div class="bt-pager">
        <el-pagination
          v-model:current-page="page"
          :page-size="pageSize"
          :total="total"
          layout="total, prev, pager, next"
          @current-change="loadList()"
        />
      </div>
    </el-card>

    <!-- 新建变更单对话框 -->
    <el-dialog v-model="createDialog" title="新建变更单" width="620px" destroy-on-close>
      <el-form :model="createForm" label-width="100px">
        <el-form-item label="标题" required>
          <el-input v-model="createForm.title" placeholder="8-80 字，如：【缺陷修复】xxx 修正" maxlength="80" show-word-limit />
        </el-form-item>
        <el-form-item label="类型" required>
          <el-select v-model="createForm.type" style="width: 200px">
            <el-option v-for="t in TYPE_OPTIONS" :key="t" :label="t" :value="t" />
          </el-select>
        </el-form-item>
        <el-form-item label="来源类型" required>
          <el-select v-model="createForm.sourceType" style="width: 200px">
            <el-option label="技术改进" value="TECH" />
            <el-option label="缺陷" value="BUG" />
            <el-option label="需求" value="REQUIREMENT" />
            <el-option label="线上事件" value="INCIDENT" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="createForm.sourceType === 'BUG' || createForm.sourceType === 'REQUIREMENT'" label="来源 ID" required>
          <el-input-number v-model="createForm.sourceId" :min="1" style="width: 200px" />
        </el-form-item>
        <el-form-item label="源分支" required>
          <el-input v-model="createForm.srcBranch" placeholder="如 bugfix/BUG-xxx-login-fix" />
        </el-form-item>
        <el-form-item label="目标分支" required>
          <el-select v-model="createForm.dstBranch" style="width: 240px" allow-create filterable default-first-option>
            <el-option label="main（主干）" value="main" />
            <el-option label="release/v1.0" value="release/v1.0" />
          </el-select>
        </el-form-item>
        <el-form-item label="风险等级">
          <el-radio-group v-model="createForm.riskLevel">
            <el-radio-button value="LOW">低</el-radio-button>
            <el-radio-button value="MEDIUM">中</el-radio-button>
            <el-radio-button value="HIGH">高</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="需要回归">
          <el-switch v-model="createForm.needRegression" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createDialog = false">取消</el-button>
        <el-button type="primary" :loading="creating" @click="onCreate">创建（草稿）</el-button>
      </template>
    </el-dialog>

    <!-- 详情抽屉 -->
    <el-drawer v-model="detailDrawer" size="560px" :title="detail?.code ?? '详情'">
      <template v-if="detail">
        <el-descriptions :column="1" border size="small" class="mb16">
          <el-descriptions-item label="标题">{{ detail.title }}</el-descriptions-item>
          <el-descriptions-item label="类型 / 风险">
            <el-tag :type="typeTag(detail.type)" size="small" effect="dark">{{ detail.type }}</el-tag>
            <el-tag :type="riskTag(detail.riskLevel)" size="small" style="margin-left: 6px">{{ detail.riskLevel }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="statusTag(detail.status)" size="small">{{ STATUS_LABELS[detail.status] ?? detail.status }}</el-tag>
            <el-tag v-if="detail.backflowStatus" :type="detail.backflowStatus === 'PENDING' ? 'danger' : 'success'" size="small" style="margin-left: 6px">
              回流{{ detail.backflowStatus === 'PENDING' ? '待办' : '完成' }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="分支">
            <code class="branch-code">{{ detail.srcBranch }}</code> → <code class="branch-code">{{ detail.dstBranch }}</code>
          </el-descriptions-item>
          <el-descriptions-item label="负责人">{{ detail.owner?.realname ?? '—' }}</el-descriptions-item>
          <el-descriptions-item label="评审人">{{ detail.reviewer?.realname ?? '—' }}</el-descriptions-item>
          <el-descriptions-item v-if="detail.mergedAt" label="合入">
            {{ formatTime(detail.mergedAt) }} · {{ detail.merger?.realname ?? '—' }}
            <code v-if="detail.mergedSha" class="branch-code">{{ detail.mergedSha }}</code>
          </el-descriptions-item>
          <el-descriptions-item v-if="detail.tag" label="发布 Tag">{{ detail.tag }}</el-descriptions-item>
        </el-descriptions>

        <!-- 状态机驱动操作区 -->
        <div v-if="availableActions.length > 0" class="action-bar mb16">
          <el-button v-for="a in availableActions" :key="a.action" :type="a.btnType" size="small" @click="onAction(a)">
            {{ a.label }}
          </el-button>
        </div>
        <el-alert v-else title="当前状态为终态或当前角色无可执行操作" type="info" :closable="false" class="mb16" />

        <!-- 流转时间轴 -->
        <h4 class="section-title">流转记录</h4>
        <el-timeline>
          <el-timeline-item
            v-for="log in detail.logs"
            :key="log.id"
            :timestamp="formatTime(log.createdAt)"
            :type="timelineType(log.action)"
          >
            <b>{{ ACTION_LABELS[log.action] ?? log.action }}</b>
            <span class="dim"> · {{ log.operator.realname }}（{{ log.fromStatus }} → {{ log.toStatus }}）</span>
            <div v-if="log.comment" class="log-comment">{{ log.comment }}</div>
          </el-timeline-item>
        </el-timeline>
      </template>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
// T5-4 · 变更流转页面：KPI 卡片 + ECharts 图表（状态分布/趋势）+ CR 列表 + 状态机操作 + 待回流清单
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import * as echarts from 'echarts';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  listChanges,
  getChange,
  createChange,
  submitChange,
  approveChange,
  rejectReviewChange,
  startBuildChange,
  buildDoneChange,
  regressionDoneChange,
  gatePassChange,
  mergeChange,
  releaseChange,
  abandonChange,
  backflowDoneChange,
  getChangeOverview,
  getChangeTrend,
  getBackflowList,
  type ChangeRequest,
  type ChangeRequestDetail,
  type CrStatus,
} from '../../api/change';
import { listProjects, type Project } from '../../api/project';
import { useUserStore } from '../../stores/user';

const userStore = useUserStore();
const role = computed(() => userStore.user?.role ?? 'DEV');

const STATUS_LABELS: Record<string, string> = {
  DRAFT: '草稿', IN_REVIEW: '待评审', APPROVED: '已批准', BUILDING: '构建中',
  REGRESSION: '待回归', GATE_CHECK: '门禁校验', AWAITING_MERGE: '待合入',
  MERGED: '已合入', RELEASED: '已发布', ABANDONED: '已废弃',
};
const ACTION_LABELS: Record<string, string> = {
  create: '新建变更单', submit: '提交评审', approve: '评审通过', 'reject-review': '评审驳回', 'start-build': '触发构建',
  'build-done': '构建完成', 'regression-done': '回归完成', 'gate-pass': '门禁通过',
  merge: '合入', release: '发布', abandon: '废弃', 'backflow-done': '回流完成',
};
const TYPE_OPTIONS = ['FEATURE', 'BUGFIX', 'HOTFIX', 'CONFIG', 'DEPENDENCY', 'ROLLBACK'];
const TERMINAL: CrStatus[] = ['RELEASED', 'ABANDONED'];

// —— 状态 / 数据 ——
const projects = ref<Project[]>([]);
const projectId = ref<number>(0);
const overview = ref<Awaited<ReturnType<typeof getChangeOverview>> | null>(null);
const backflows = ref<Awaited<ReturnType<typeof getBackflowList>>>([]);
const crs = ref<ChangeRequest[]>([]);
const page = ref(1);
const pageSize = 10;
const total = ref(0);
const filterStatus = ref('');
const filterType = ref('');

const detailDrawer = ref(false);
const detail = ref<ChangeRequestDetail | null>(null);

const createDialog = ref(false);
const creating = ref(false);
const createForm = ref({
  title: '', type: 'BUGFIX', sourceType: 'TECH', sourceId: undefined as number | undefined,
  srcBranch: '', dstBranch: 'main', riskLevel: 'MEDIUM', needRegression: true,
});

// —— KPI 卡片 ——
const kpiCards = computed(() => {
  const o = overview.value;
  const active = o ? o.total - (o.byStatus.RELEASED ?? 0) - (o.byStatus.ABANDONED ?? 0) : 0;
  return [
    { label: '变更总数', value: o?.total ?? 0, color: '#4f46e5' },
    { label: '进行中', value: active, color: '#0891b2' },
    { label: '已发布', value: o?.mergedCount ? (o.byStatus.RELEASED ?? 0) : 0, color: '#16a34a' },
    { label: '平均流转(小时)', value: o?.avgMergeHours ?? 0, color: '#d97706' },
    { label: '待回流', value: o?.pendingBackflow ?? 0, color: (o?.pendingBackflow ?? 0) > 0 ? '#dc2626' : '#16a34a' },
  ];
});

// —— 状态机按钮显隐（与后端 change-status.machine.ts 同口径；服务端为最终防线） ——
interface ActionBtn { action: string; label: string; btnType: 'primary' | 'success' | 'warning' | 'danger' | 'info' }
const availableActions = computed<ActionBtn[]>(() => {
  const d = detail.value;
  if (!d || TERMINAL.includes(d.status)) return [];
  const btns: ActionBtn[] = [];
  const byStatus: Record<string, Array<{ role: string[] } & ActionBtn>> = {
    DRAFT: [{ action: 'submit', label: '提交评审', btnType: 'primary', role: ['DEV', 'ADMIN'] }],
    IN_REVIEW: [
      { action: 'approve', label: '评审通过', btnType: 'success', role: ['DEV', 'ADMIN'] },
      { action: 'reject-review', label: '评审驳回', btnType: 'warning', role: ['DEV', 'ADMIN'] },
    ],
    APPROVED: [{ action: 'start-build', label: '触发构建', btnType: 'primary', role: ['ADMIN'] }],
    BUILDING: [{ action: 'build-done', label: '构建完成', btnType: 'primary', role: ['ADMIN'] }],
    REGRESSION: [{ action: 'regression-done', label: '回归完成', btnType: 'primary', role: ['QA', 'ADMIN'] }],
    GATE_CHECK: [{ action: 'gate-pass', label: '门禁通过', btnType: 'primary', role: ['ADMIN'] }],
    AWAITING_MERGE: [
      { action: 'merge', label: '合入', btnType: 'success', role: ['ADMIN'] },
    ],
    MERGED: [{ action: 'release', label: '发布', btnType: 'success', role: ['ADMIN'] }],
  };
  for (const b of byStatus[d.status] ?? []) {
    if (b.role.includes(role.value)) {
      btns.push({ action: b.action, label: b.label, btnType: b.btnType });
    }
  }
  // 废弃：任意非终态（创建人/ADMIN；服务端校验）
  const isOwner = d.ownerId === userStore.user?.id;
  if (isOwner || role.value === 'ADMIN') {
    btns.push({ action: 'abandon', label: '废弃', btnType: 'danger' });
  }
  // 回流标记
  if (d.backflowStatus === 'PENDING' && (role.value === 'QA' || role.value === 'ADMIN')) {
    btns.push({ action: 'backflow-done', label: '标记已回流', btnType: 'info' });
  }
  return btns;
});

// —— 图表 ——
const statusChartEl = ref<HTMLDivElement>();
const trendChartEl = ref<HTMLDivElement>();
let statusChart: echarts.ECharts | null = null;
let trendChart: echarts.ECharts | null = null;

const STATUS_COLORS: Record<string, string> = {
  DRAFT: '#94a3b8', IN_REVIEW: '#f59e0b', APPROVED: '#3b82f6', BUILDING: '#8b5cf6',
  REGRESSION: '#06b6d4', GATE_CHECK: '#0ea5e9', AWAITING_MERGE: '#6366f1',
  MERGED: '#22c55e', RELEASED: '#16a34a', ABANDONED: '#dc2626',
};

function renderCharts() {
  const o = overview.value;
  if (!o) return;
  // 状态分布环图
  if (statusChartEl.value) {
    statusChart ??= echarts.init(statusChartEl.value);
    statusChart.setOption({
      tooltip: { trigger: 'item', formatter: '{b}: {c}（{d}%）' },
      legend: { bottom: 0, itemWidth: 10, itemHeight: 10, textStyle: { fontSize: 11, color: '#6b7684' } },
      series: [{
        type: 'pie',
        radius: ['42%', '68%'],
        center: ['50%', '42%'],
        itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
        label: { show: false },
        data: Object.entries(o.byStatus).map(([s, v]) => ({
          name: STATUS_LABELS[s] ?? s,
          value: v,
          itemStyle: { color: STATUS_COLORS[s] ?? '#94a3b8' },
        })),
      }],
    });
  }
  // 趋势双序列图
  if (trendChartEl.value) {
    trendChart ??= echarts.init(trendChartEl.value);
    const series = trendData.value;
    trendChart.setOption({
      tooltip: { trigger: 'axis' },
      legend: { data: ['新建变更', '流转事件'], top: 0, textStyle: { fontSize: 11, color: '#6b7684' } },
      grid: { left: 36, right: 16, top: 32, bottom: 24 },
      xAxis: { type: 'category', data: series.map((p) => p.date), axisLabel: { fontSize: 10, color: '#6b7684' } },
      yAxis: { type: 'value', minInterval: 1, axisLabel: { fontSize: 10, color: '#6b7684' }, splitLine: { lineStyle: { color: '#f1f2f6' } } },
      series: [
        {
          name: '新建变更', type: 'bar', barMaxWidth: 14, itemStyle: { borderRadius: [4, 4, 0, 0], color: '#6366f1' },
          data: series.map((p) => p.created),
        },
        {
          name: '流转事件', type: 'line', smooth: true, symbolSize: 5,
          lineStyle: { color: '#22c55e', width: 2 }, itemStyle: { color: '#22c55e' },
          data: series.map((p) => p.transitions),
        },
      ],
    });
  }
}

const trendData = ref<Awaited<ReturnType<typeof getChangeTrend>>['series']>([]);

// —— 数据加载 ——
async function reloadAll() {
  if (!projectId.value) return;
  await Promise.all([loadOverview(), loadTrend(), loadBackflows(), loadList(1)]);
}

async function loadOverview() {
  overview.value = await getChangeOverview(projectId.value);
  await nextTick();
  renderCharts();
}

async function loadTrend() {
  const r = await getChangeTrend(projectId.value, 14);
  trendData.value = r.series;
  await nextTick();
  renderCharts();
}

async function loadBackflows() {
  backflows.value = await getBackflowList(projectId.value);
}

async function loadList(p?: number) {
  if (p) page.value = p;
  const r = await listChanges({
    projectId: projectId.value,
    status: filterStatus.value || undefined,
    type: filterType.value || undefined,
    page: page.value,
    pageSize,
  });
  crs.value = r.list;
  total.value = r.total;
}

// —— 操作 ——
async function onCreate() {
  const f = createForm.value;
  if (!f.title || f.title.length < 8 || !f.srcBranch) {
    ElMessage.warning('请填写标题（≥8字）与源分支');
    return;
  }
  creating.value = true;
  try {
    await createChange({
      projectId: projectId.value, title: f.title, type: f.type, sourceType: f.sourceType,
      sourceId: f.sourceType === 'BUG' || f.sourceType === 'REQUIREMENT' ? f.sourceId : undefined,
      srcBranch: f.srcBranch, dstBranch: f.dstBranch, riskLevel: f.riskLevel, needRegression: f.needRegression,
    });
    ElMessage.success('变更单已创建（草稿）');
    createDialog.value = false;
    createForm.value = {
      title: '', type: 'BUGFIX', sourceType: 'TECH', sourceId: undefined,
      srcBranch: '', dstBranch: 'main', riskLevel: 'MEDIUM', needRegression: true,
    };
    await reloadAll();
  } catch {
    // request 层已统一弹错
  } finally {
    creating.value = false;
  }
}

async function openDetail(row: ChangeRequest) {
  detail.value = await getChange(row.id);
  detailDrawer.value = true;
}

async function refreshDetail() {
  if (detail.value) detail.value = await getChange(detail.value.id);
  await Promise.all([loadList(), loadOverview(), loadBackflows()]);
}

async function onAction(btn: ActionBtn) {
  const d = detail.value;
  if (!d) return;
  try {
    switch (btn.action) {
      case 'submit':
        await submitChange(d.id);
        ElMessage.success('已提交评审');
        break;
      case 'approve':
        await approveChange(d.id);
        ElMessage.success('已通过评审');
        break;
      case 'reject-review': {
        const { value } = await ElMessageBox.prompt('请填写驳回理由', '评审驳回', {
          inputValidator: (v: string) => (v?.trim() ? true : '理由不能为空'),
        });
        await rejectReviewChange(d.id, value);
        ElMessage.success('已驳回至草稿');
        break;
      }
      case 'start-build':
        await startBuildChange(d.id);
        ElMessage.success('已触发构建');
        break;
      case 'build-done':
        await buildDoneChange(d.id);
        ElMessage.success('构建完成');
        break;
      case 'regression-done':
        await regressionDoneChange(d.id);
        ElMessage.success('回归完成');
        break;
      case 'gate-pass':
        await gatePassChange(d.id);
        ElMessage.success('门禁校验通过');
        break;
      case 'merge': {
        const { value } = await ElMessageBox.prompt('请填写合入提交 sha（可留空）', '合入', {
          inputValidator: () => true, inputPattern: /^[a-zA-Z0-9]*$/, inputErrorMessage: 'sha 格式不正确',
        });
        await mergeChange(d.id, { mergedSha: value || undefined });
        ElMessage.success('已合入');
        break;
      }
      case 'release': {
        const { value } = await ElMessageBox.prompt('请填写发布 Tag', '发布', {
          inputValidator: (v: string) => (v?.trim() ? true : 'Tag 不能为空'),
        });
        await releaseChange(d.id, { tag: value });
        ElMessage.success(`已发布（Tag：${value}）`);
        break;
      }
      case 'abandon': {
        const { value } = await ElMessageBox.prompt('请填写废弃原因', '废弃变更单', {
          inputValidator: (v: string) => (v?.trim() ? true : '原因不能为空'),
        });
        await abandonChange(d.id, value);
        ElMessage.success('已废弃');
        break;
      }
      case 'backflow-done':
        await backflowDoneChange(d.id);
        ElMessage.success('已标记回流完成');
        break;
    }
    await refreshDetail();
  } catch {
    // 取消或错误：request 层已统一弹错
  }
}

async function onBackflowDone(row: { id: string }) {
  await backflowDoneChange(row.id);
  ElMessage.success('已标记回流完成');
  await Promise.all([loadBackflows(), loadList(), loadOverview()]);
  if (detail.value && detail.value.id === row.id) detail.value = await getChange(row.id);
}

// —— 样式映射 ——
function statusTag(s: string): 'info' | 'warning' | 'primary' | 'success' | 'danger' {
  if (s === 'RELEASED' || s === 'MERGED') return 'success';
  if (s === 'ABANDONED') return 'danger';
  if (s === 'IN_REVIEW' || s === 'REGRESSION') return 'warning';
  return 'info';
}
function typeTag(t: string): 'primary' | 'danger' | 'warning' | 'info' {
  if (t === 'HOTFIX') return 'danger';
  if (t === 'BUGFIX') return 'primary';
  if (t === 'FEATURE') return 'warning';
  return 'info';
}
function riskTag(r: string): 'danger' | 'warning' | 'success' {
  if (r === 'HIGH') return 'danger';
  if (r === 'MEDIUM') return 'warning';
  return 'success';
}
function timelineType(a: string): 'primary' | 'success' | 'danger' | 'warning' {
  if (a === 'merge' || a === 'release' || a === 'approve') return 'success';
  if (a === 'abandon' || a === 'reject-review') return 'danger';
  if (a === 'submit' || a === 'start-build') return 'primary';
  return 'warning';
}
function formatTime(v: string) {
  return new Date(v).toLocaleString('zh-CN', { hour12: false });
}

// —— 生命周期 ——
onMounted(async () => {
  const r = await listProjects({ page: 1, pageSize: 100 });
  projects.value = r.list;
  if (r.list.length > 0) {
    projectId.value = Number(r.list[0].id);
    await reloadAll();
  }
  window.addEventListener('resize', resizeCharts);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', resizeCharts);
  statusChart?.dispose();
  trendChart?.dispose();
});

function resizeCharts() {
  statusChart?.resize();
  trendChart?.resize();
}

watch(createDialog, () => undefined);
</script>

<style scoped>
.change-view { display: flex; flex-direction: column; gap: 0; }

.kpi-row { margin-bottom: 12px; }
.kpi-card { text-align: center; }
.kpi-card :deep(.el-card__body) { padding: 16px 8px; }
.kpi-value { font-size: 26px; font-weight: 800; line-height: 1.2; }
.kpi-label { margin-top: 6px; font-size: 12px; color: var(--bt-text-muted); }

.chart-row { margin-bottom: 12px; }
.chart { height: 240px; }

.backflow-card :deep(.el-card__header) { color: #b91c1c; }

.list-filter { display: flex; gap: 8px; padding: 12px 16px; border-bottom: 1px solid var(--bt-border); }

.branch-code {
  background: var(--bt-gradient-soft);
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 12px;
  color: var(--bt-primary-dark);
}

.action-bar { display: flex; flex-wrap: wrap; gap: 8px; }
.section-title { margin: 8px 0 12px; font-size: 14px; color: var(--bt-text-title); }
.dim { color: var(--bt-text-muted); font-size: 12px; }
.log-comment {
  margin-top: 4px;
  padding: 6px 10px;
  background: var(--bt-gradient-soft);
  border-radius: 6px;
  font-size: 12px;
  color: var(--bt-text-body);
}
.mb16 { margin-bottom: 16px; }
</style>
