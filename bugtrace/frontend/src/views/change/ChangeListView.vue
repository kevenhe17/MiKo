<template>
  <div class="change-view">
    <!-- Hero 页头 -->
    <div class="hero">
      <div>
        <h3 class="hero-title">变更流转</h3>
        <p class="hero-sub">主干 / 分支软件变更 · 状态机驱动的流转与度量</p>
      </div>
      <div class="bt-actions">
        <a-select
          v-model:value="projectId"
          placeholder="选择项目"
          style="width: 220px"
          :options="projectOptions"
          @change="reloadAll"
        />
        <a-button type="primary" @click="createDialog = true">新建变更单</a-button>
      </div>
    </div>

    <!-- 指标条：大数字 + 细分隔线（无卡片堆叠） -->
    <div class="bt-panel stat-strip">
      <div v-for="s in statItems" :key="s.label" class="stat-item">
        <div class="stat-value" :class="{ warn: s.warn }">{{ s.value }}</div>
        <div class="stat-label">{{ s.label }}</div>
      </div>
    </div>

    <!-- 流转管道：状态机可视化，点击节点筛选列表 -->
    <div class="bt-panel">
      <div class="panel-head">
        <div class="panel-title">流转管道</div>
        <div class="panel-hint">点击节点筛选列表</div>
      </div>
      <div class="pipeline">
        <template v-for="(node, i) in pipelineNodes" :key="node.status">
          <div
            class="pipe-node"
            :class="{ active: node.count > 0, selected: filterStatus === node.status }"
            @click="onNodeClick(node.status)"
          >
            <div class="pipe-dot">{{ node.count }}</div>
            <div class="pipe-label">{{ node.label }}</div>
          </div>
          <div v-if="i < pipelineNodes.length - 1" class="pipe-link"></div>
        </template>
      </div>
    </div>

    <!-- 趋势图：Apple Health 式极简坐标 -->
    <div class="bt-panel">
      <div class="panel-head">
        <div class="panel-title">近 14 天流转趋势</div>
        <div class="mini-legend">
          <span class="lg"><i class="lg-dot" style="background: #3b8cff"></i>新建变更</span>
          <span class="lg"><i class="lg-dot" style="background: #34c759"></i>流转事件</span>
        </div>
      </div>
      <div class="trend-wrap">
        <div ref="trendChartEl" class="chart"></div>
        <div v-if="trendEmpty" class="trend-empty">
          <div class="trend-empty-title">暂无流转数据</div>
          <div class="trend-empty-sub">新建一个变更单，开始追踪流转趋势</div>
        </div>
      </div>
    </div>

    <!-- 待回流清单 -->
    <div v-if="backflows.length > 0" class="bt-panel">
      <div class="panel-head">
        <div class="panel-title">
          待回流清单
          <span class="count-badge">{{ backflows.length }}</span>
        </div>
        <div class="panel-hint danger">需关注</div>
      </div>
      <a-table
        :columns="backflowColumns"
        :data-source="backflows"
        :pagination="false"
        row-key="id"
        size="small"
        class="panel-table"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'type'">
            <a-tag :color="typeTagColor(record.type)">{{ record.type }}</a-tag>
          </template>
          <template v-else-if="column.key === 'branch'">
            <code class="branch-code">{{ record.srcBranch }}</code>
            →
            <code class="branch-code">{{ record.dstBranch }}</code>
          </template>
          <template v-else-if="column.key === 'owner'">
            <span class="cell-desc">{{ record.owner?.realname ?? '—' }}</span>
          </template>
          <template v-else-if="column.key === 'action'">
            <a-button size="small" type="primary" class="act-success" @click="onBackflowDone(record)">
              标记已回流
            </a-button>
          </template>
        </template>
      </a-table>
    </div>

    <!-- CR 列表 -->
    <div class="bt-panel">
      <div class="panel-head">
        <div class="panel-title">变更单列表</div>
        <div class="list-filter">
          <a-select
            v-model:value="filterStatus"
            placeholder="状态筛选"
            allow-clear
            style="width: 140px"
            :options="statusOptions"
            @change="loadList(1)"
          />
          <a-select
            v-model:value="filterType"
            placeholder="类型筛选"
            allow-clear
            style="width: 130px"
            :options="typeOptions"
            @change="loadList(1)"
          />
        </div>
      </div>

      <a-table
        :columns="columns"
        :data-source="crs"
        :loading="listLoading"
        :pagination="pagination"
        row-key="id"
        class="panel-table"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'code'">
            <a-button type="link" class="cell-link" @click="openDetail(record)">
              {{ record.code }}
            </a-button>
          </template>
          <template v-else-if="column.key === 'title'">
            <div class="cell-primary">{{ record.title }}</div>
          </template>
          <template v-else-if="column.key === 'type'">
            <a-tag :color="typeTagColor(record.type)">{{ record.type }}</a-tag>
          </template>
          <template v-else-if="column.key === 'risk'">
            <a-tag :color="riskTagColor(record.riskLevel)">{{ record.riskLevel }}</a-tag>
          </template>
          <template v-else-if="column.key === 'status'">
            <span class="status-pill">
              <i class="sp-dot" :style="{ background: statusColor(record.status) }"></i>
              {{ STATUS_LABELS[record.status] ?? record.status }}
            </span>
          </template>
          <template v-else-if="column.key === 'branch'">
            <code class="branch-code">{{ record.srcBranch }}</code>
            →
            <code class="branch-code">{{ record.dstBranch }}</code>
          </template>
          <template v-else-if="column.key === 'owner'">
            <span class="cell-desc">{{ record.owner?.realname ?? '—' }}</span>
          </template>
          <template v-else-if="column.key === 'updatedAt'">
            <span class="cell-time">{{ formatTime(record.updatedAt) }}</span>
          </template>
        </template>

        <template #emptyText>
          <div class="table-empty">
            <div class="table-empty-title">暂无变更单</div>
            <div class="table-empty-sub">点击右上角「新建变更单」创建第一个变更</div>
          </div>
        </template>
      </a-table>
    </div>

    <!-- 新建变更单 -->
    <a-modal
      v-model:open="createDialog"
      title="新建变更单"
      :width="620"
      :confirm-loading="creating"
      ok-text="创建（草稿）"
      cancel-text="取消"
      destroy-on-close
      @ok="onCreate"
    >
      <a-form :model="createForm" :label-col="{ flex: '100px' }" class="dlg-form">
        <a-form-item label="标题" required>
          <a-input
            v-model:value="createForm.title"
            placeholder="8-80 字，如：【缺陷修复】xxx 修正"
            :maxlength="80"
            show-count
          />
        </a-form-item>
        <a-form-item label="类型" required>
          <a-select v-model:value="createForm.type" style="width: 200px" :options="typeOptions" />
        </a-form-item>
        <a-form-item label="来源类型" required>
          <a-select
            v-model:value="createForm.sourceType"
            style="width: 200px"
            :options="SOURCE_OPTIONS"
          />
        </a-form-item>
        <a-form-item
          v-if="createForm.sourceType === 'BUG' || createForm.sourceType === 'REQUIREMENT'"
          label="来源 ID"
          required
        >
          <a-input-number v-model:value="createForm.sourceId" :min="1" style="width: 200px" />
        </a-form-item>
        <a-form-item label="源分支" required>
          <a-input v-model:value="createForm.srcBranch" placeholder="如 bugfix/BUG-xxx-login-fix" />
        </a-form-item>
        <a-form-item label="目标分支" required>
          <a-auto-complete
            v-model:value="createForm.dstBranch"
            :options="DST_BRANCH_OPTIONS"
            placeholder="输入或选择目标分支"
            style="width: 240px"
          />
        </a-form-item>
        <a-form-item label="风险等级">
          <a-radio-group v-model:value="createForm.riskLevel">
            <a-radio-button value="LOW">低</a-radio-button>
            <a-radio-button value="MEDIUM">中</a-radio-button>
            <a-radio-button value="HIGH">高</a-radio-button>
          </a-radio-group>
        </a-form-item>
        <a-form-item label="需要回归">
          <a-switch v-model:checked="createForm.needRegression" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 详情抽屉 -->
    <a-drawer
      v-model:open="detailDrawer"
      :width="560"
      :title="detail?.code ?? '详情'"
      placement="right"
    >
      <template v-if="detail">
        <a-descriptions :column="1" bordered size="small" class="mb16">
          <a-descriptions-item label="标题">{{ detail.title }}</a-descriptions-item>
          <a-descriptions-item label="类型 / 风险">
            <a-tag :color="typeTagColor(detail.type)">{{ detail.type }}</a-tag>
            <a-tag :color="riskTagColor(detail.riskLevel)" style="margin-left: 6px">
              {{ detail.riskLevel }}
            </a-tag>
          </a-descriptions-item>
          <a-descriptions-item label="状态">
            <a-tag :color="statusTagColor(detail.status)">
              {{ STATUS_LABELS[detail.status] ?? detail.status }}
            </a-tag>
            <a-tag
              v-if="detail.backflowStatus"
              :color="detail.backflowStatus === 'PENDING' ? 'red' : 'green'"
              style="margin-left: 6px"
            >
              回流{{ detail.backflowStatus === 'PENDING' ? '待办' : '完成' }}
            </a-tag>
          </a-descriptions-item>
          <a-descriptions-item label="分支">
            <code class="branch-code">{{ detail.srcBranch }}</code>
            →
            <code class="branch-code">{{ detail.dstBranch }}</code>
          </a-descriptions-item>
          <a-descriptions-item label="负责人">{{ detail.owner?.realname ?? '—' }}</a-descriptions-item>
          <a-descriptions-item label="评审人">{{ detail.reviewer?.realname ?? '—' }}</a-descriptions-item>
          <a-descriptions-item v-if="detail.mergedAt" label="合入">
            {{ formatTime(detail.mergedAt) }} · {{ detail.merger?.realname ?? '—' }}
            <code v-if="detail.mergedSha" class="branch-code">{{ detail.mergedSha }}</code>
          </a-descriptions-item>
          <a-descriptions-item v-if="detail.tag" label="发布 Tag">{{ detail.tag }}</a-descriptions-item>
        </a-descriptions>

        <!-- 状态机驱动操作区 -->
        <div v-if="availableActions.length > 0" class="action-bar mb16">
          <a-button
            v-for="a in availableActions"
            :key="a.action"
            size="small"
            :type="a.btnType"
            :class="a.btnClass"
            @click="onAction(a)"
          >
            {{ a.label }}
          </a-button>
        </div>
        <a-alert
          v-else
          title="当前状态为终态或当前角色无可执行操作"
          type="info"
          :closable="false"
          show-icon
          class="mb16"
        />

        <!-- 流转时间轴 -->
        <h4 class="section-title">流转记录</h4>
        <a-timeline>
          <a-timeline-item
            v-for="log in detail.logs"
            :key="log.id"
            :color="timelineColor(log.action)"
          >
            <b>{{ ACTION_LABELS[log.action] ?? log.action }}</b>
            <span class="dim">
              · {{ log.operator.realname }}（{{ log.fromStatus }} → {{ log.toStatus }}）
            </span>
            <div v-if="log.comment" class="log-comment">{{ log.comment }}</div>
            <div class="log-time">{{ formatTime(log.createdAt) }}</div>
          </a-timeline-item>
        </a-timeline>
      </template>
    </a-drawer>

    <!-- 统一输入弹窗：替代 ElMessageBox.prompt（antdv 无 prompt API） -->
    <a-modal
      v-model:open="prompt.visible"
      :title="prompt.title"
      :width="440"
      :ok-text="prompt.okText"
      cancel-text="取消"
      :ok-button-props="{ disabled: prompt.required && !prompt.value.trim(), danger: prompt.danger }"
      @ok="submitPrompt"
    >
      <a-textarea
        v-model:value="prompt.value"
        :rows="3"
        :placeholder="prompt.placeholder"
        @press-enter="submitPrompt"
      />
    </a-modal>
  </div>
</template>

<script setup lang="ts">
// v0.2 · 迁移到 Ant Design Vue：Table / Modal / Drawer / Descriptions / Timeline /
//        Select / AutoComplete / InputNumber / Switch / Radio / Tag / Alert
// 注：ElMessageBox.prompt 无 antdv 等价物，改为统一的受控输入弹窗（prompt state）
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import * as echarts from 'echarts';
import type { TableColumnsType } from 'ant-design-vue';
import { App } from 'ant-design-vue';
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

const { message } = App.useApp();
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
const SOURCE_OPTIONS = [
  { label: '技术改进', value: 'TECH' },
  { label: '缺陷', value: 'BUG' },
  { label: '需求', value: 'REQUIREMENT' },
  { label: '线上事件', value: 'INCIDENT' },
];
const DST_BRANCH_OPTIONS = [{ value: 'main' }, { value: 'release/v1.0' }];
const TERMINAL: CrStatus[] = ['RELEASED', 'ABANDONED'];

// 主流水线上的状态顺序（已废弃不入管道）
const PIPELINE: CrStatus[] = [
  'DRAFT', 'IN_REVIEW', 'APPROVED', 'BUILDING', 'REGRESSION',
  'GATE_CHECK', 'AWAITING_MERGE', 'MERGED', 'RELEASED',
];

// —— 状态 / 数据 ——
const projects = ref<Project[]>([]);
const projectId = ref<number>(0);
const overview = ref<Awaited<ReturnType<typeof getChangeOverview>> | null>(null);
const backflows = ref<Awaited<ReturnType<typeof getBackflowList>>>([]);
const crs = ref<ChangeRequest[]>([]);
const listLoading = ref(false);
const page = ref(1);
const pageSize = 10;
const total = ref(0);
const filterStatus = ref<string | undefined>(undefined);
const filterType = ref<string | undefined>(undefined);

const detailDrawer = ref(false);
const detail = ref<ChangeRequestDetail | null>(null);

const createDialog = ref(false);
const creating = ref(false);
const createForm = ref({
  title: '', type: 'BUGFIX', sourceType: 'TECH', sourceId: undefined as number | undefined,
  srcBranch: '', dstBranch: 'main', riskLevel: 'MEDIUM', needRegression: true,
});

// —— 统一输入弹窗（替代 ElMessageBox.prompt） ——
const prompt = reactive({
  visible: false,
  title: '',
  placeholder: '',
  value: '',
  required: true,
  okText: '确定',
  danger: false,
  handler: null as null | ((v: string) => Promise<void>),
});

function openPrompt(
  opts: { title: string; placeholder?: string; required?: boolean; okText?: string; danger?: boolean },
  handler: (v: string) => Promise<void>,
) {
  prompt.title = opts.title;
  prompt.placeholder = opts.placeholder ?? '';
  prompt.required = opts.required ?? true;
  prompt.okText = opts.okText ?? '确定';
  prompt.danger = opts.danger ?? false;
  prompt.value = '';
  prompt.handler = handler;
  prompt.visible = true;
}

async function submitPrompt() {
  if (prompt.required && !prompt.value.trim()) {
    message.warning('内容不能为空');
    return;
  }
  const handler = prompt.handler;
  const value = prompt.value;
  prompt.visible = false;
  prompt.handler = null;
  if (!handler) return;
  try {
    await handler(value);
  } catch {
    // 拦截器统一提示
  }
}

// —— 下拉选项 ——
const projectOptions = computed(() =>
  projects.value.map((p) => ({ label: `${p.name}（${p.code}）`, value: Number(p.id) })),
);
const statusOptions = computed(() =>
  Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label })),
);
const typeOptions = TYPE_OPTIONS.map((t) => ({ label: t, value: t }));

// —— 指标条 ——
const statItems = computed(() => {
  const o = overview.value;
  const active = o ? o.total - (o.byStatus.RELEASED ?? 0) - (o.byStatus.ABANDONED ?? 0) : 0;
  const pending = o?.pendingBackflow ?? 0;
  return [
    { label: '变更总数', value: o?.total ?? 0, warn: false },
    { label: '进行中', value: active, warn: false },
    { label: '已发布', value: o?.byStatus.RELEASED ?? 0, warn: false },
    { label: '平均流转（小时）', value: o?.avgMergeHours ?? 0, warn: false },
    { label: '待回流', value: pending, warn: pending > 0 },
  ];
});

// —— 流转管道节点 ——
const pipelineNodes = computed(() =>
  PIPELINE.map((s) => ({
    status: s as string,
    label: STATUS_LABELS[s],
    count: (overview.value?.byStatus as Record<string, number> | undefined)?.[s] ?? 0,
  })),
);

function onNodeClick(s: string) {
  filterStatus.value = filterStatus.value === s ? undefined : s;
  loadList(1);
}

// —— 表格列 ——
const backflowColumns: TableColumnsType = [
  { title: '编号', dataIndex: 'code', key: 'code', width: 160 },
  { title: '标题', dataIndex: 'title', key: 'title', ellipsis: true },
  { title: '类型', key: 'type', width: 110 },
  { title: '分支', key: 'branch', width: 240 },
  { title: '负责人', key: 'owner', width: 110 },
  { title: '', key: 'action', width: 130 },
];

const columns: TableColumnsType = [
  { title: '编号', key: 'code', width: 160 },
  { title: '标题', key: 'title', width: 260 },
  { title: '类型', key: 'type', width: 120 },
  { title: '风险', key: 'risk', width: 100 },
  { title: '状态', key: 'status', width: 130 },
  { title: '分支流向', key: 'branch', width: 240 },
  { title: '负责人', key: 'owner', width: 110 },
  { title: '更新时间', key: 'updatedAt', width: 180 },
];

const pagination = computed(() => ({
  current: page.value,
  pageSize,
  total: total.value,
  showSizeChanger: false,
  showTotal: (t: number) => `共 ${t} 条`,
  onChange: (p: number) => {
    void loadList(p);
  },
}));

// —— 状态机按钮显隐（与后端 change-status.machine.ts 同口径；服务端为最终防线） ——
interface ActionBtn {
  action: string;
  label: string;
  btnType: 'primary' | 'default' | 'dashed' | 'link' | 'text';
  btnClass?: string;
}
const availableActions = computed<ActionBtn[]>(() => {
  const d = detail.value;
  if (!d || TERMINAL.includes(d.status)) return [];
  const btns: ActionBtn[] = [];
  const byStatus: Record<string, Array<{ role: string[] } & ActionBtn>> = {
    DRAFT: [{ action: 'submit', label: '提交评审', btnType: 'primary', role: ['DEV', 'ADMIN'] }],
    IN_REVIEW: [
      { action: 'approve', label: '评审通过', btnType: 'primary', btnClass: 'act-success', role: ['DEV', 'ADMIN'] },
      { action: 'reject-review', label: '评审驳回', btnType: 'primary', btnClass: 'act-warning', role: ['DEV', 'ADMIN'] },
    ],
    APPROVED: [{ action: 'start-build', label: '触发构建', btnType: 'primary', role: ['ADMIN'] }],
    BUILDING: [{ action: 'build-done', label: '构建完成', btnType: 'primary', role: ['ADMIN'] }],
    REGRESSION: [{ action: 'regression-done', label: '回归完成', btnType: 'primary', role: ['QA', 'ADMIN'] }],
    GATE_CHECK: [{ action: 'gate-pass', label: '门禁通过', btnType: 'primary', role: ['ADMIN'] }],
    AWAITING_MERGE: [
      { action: 'merge', label: '合入', btnType: 'primary', btnClass: 'act-success', role: ['ADMIN'] },
    ],
    MERGED: [{ action: 'release', label: '发布', btnType: 'primary', btnClass: 'act-success', role: ['ADMIN'] }],
  };
  for (const b of byStatus[d.status] ?? []) {
    if (b.role.includes(role.value)) {
      btns.push({ action: b.action, label: b.label, btnType: b.btnType, btnClass: b.btnClass });
    }
  }
  // 废弃：任意非终态（创建人/ADMIN；服务端校验）
  const isOwner = d.ownerId === userStore.user?.id;
  if (isOwner || role.value === 'ADMIN') {
    btns.push({ action: 'abandon', label: '废弃', btnType: 'default', btnClass: 'act-danger-text' });
  }
  // 回流标记
  if (d.backflowStatus === 'PENDING' && (role.value === 'QA' || role.value === 'ADMIN')) {
    btns.push({ action: 'backflow-done', label: '标记已回流', btnType: 'default' });
  }
  return btns;
});

// —— 图表 ——
const trendChartEl = ref<HTMLDivElement>();
let trendChart: echarts.ECharts | null = null;

const STATUS_COLORS: Record<string, string> = {
  DRAFT: '#94a3b8', IN_REVIEW: '#f59e0b', APPROVED: '#3b82f6', BUILDING: '#8b5cf6',
  REGRESSION: '#06b6d4', GATE_CHECK: '#0ea5e9', AWAITING_MERGE: '#6366f1',
  MERGED: '#22c55e', RELEASED: '#16a34a', ABANDONED: '#dc2626',
};

function statusColor(s: string) {
  return STATUS_COLORS[s] ?? '#94a3b8';
}

const trendData = ref<Awaited<ReturnType<typeof getChangeTrend>>['series']>([]);
const trendEmpty = computed(
  () => trendData.value.length === 0 || trendData.value.every((p) => !p.created && !p.transitions),
);

function renderTrend() {
  if (!trendChartEl.value) return;
  trendChart ??= echarts.init(trendChartEl.value);
  const series = trendData.value;
  trendChart.setOption({
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(29, 29, 31, 0.92)',
      borderWidth: 0,
      textStyle: { color: '#fff', fontSize: 12 },
      extraCssText: 'border-radius: 10px; padding: 8px 12px; box-shadow: 0 8px 24px rgba(0,0,0,0.18);',
      axisPointer: { type: 'line', lineStyle: { color: '#d2d2d7' } },
    },
    grid: { left: 8, right: 12, top: 20, bottom: 4, containLabel: true },
    xAxis: {
      type: 'category',
      data: series.map((p) => p.date),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        fontSize: 11,
        color: '#8e8e93',
        margin: 12,
        formatter: (v: string) => v.slice(5),
      },
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      axisLabel: { fontSize: 11, color: '#aeaeb2' },
      splitLine: { lineStyle: { color: '#f2f2f7', type: [4, 4] } },
    },
    series: [
      {
        name: '新建变更',
        type: 'bar',
        barMaxWidth: 14,
        itemStyle: {
          borderRadius: [5, 5, 0, 0],
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#6cb0ff' },
            { offset: 1, color: '#3b8cff' },
          ]),
        },
        data: series.map((p) => p.created),
      },
      {
        name: '流转事件',
        type: 'line',
        smooth: 0.6,
        symbol: 'circle',
        symbolSize: 6,
        showSymbol: false,
        lineStyle: { color: '#34c759', width: 2.5 },
        itemStyle: { color: '#34c759' },
        data: series.map((p) => p.transitions),
      },
    ],
  });
}

// —— 数据加载 ——
async function reloadAll() {
  if (!projectId.value) return;
  await Promise.all([loadOverview(), loadTrend(), loadBackflows(), loadList(1)]);
}

async function loadOverview() {
  overview.value = await getChangeOverview(projectId.value);
}

async function loadTrend() {
  const r = await getChangeTrend(projectId.value, 14);
  trendData.value = r.series;
  await nextTick();
  renderTrend();
}

async function loadBackflows() {
  backflows.value = await getBackflowList(projectId.value);
}

async function loadList(p?: number) {
  if (p) page.value = p;
  listLoading.value = true;
  try {
    const r = await listChanges({
      projectId: projectId.value,
      status: filterStatus.value || undefined,
      type: filterType.value || undefined,
      page: page.value,
      pageSize,
    });
    crs.value = r.list;
    total.value = r.total;
  } finally {
    listLoading.value = false;
  }
}

// —— 操作 ——
async function onCreate() {
  const f = createForm.value;
  if (!f.title || f.title.length < 8 || !f.srcBranch) {
    message.warning('请填写标题（≥8字）与源分支');
    return;
  }
  creating.value = true;
  try {
    await createChange({
      projectId: projectId.value, title: f.title, type: f.type, sourceType: f.sourceType,
      sourceId: f.sourceType === 'BUG' || f.sourceType === 'REQUIREMENT' ? f.sourceId : undefined,
      srcBranch: f.srcBranch, dstBranch: f.dstBranch, riskLevel: f.riskLevel, needRegression: f.needRegression,
    });
    message.success('变更单已创建（草稿）');
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
        message.success('已提交评审');
        break;
      case 'approve':
        await approveChange(d.id);
        message.success('已通过评审');
        break;
      case 'reject-review':
        openPrompt({ title: '评审驳回', placeholder: '请填写驳回理由', okText: '驳回', danger: true }, async (v) => {
          await rejectReviewChange(d.id, v);
          message.success('已驳回至草稿');
          await refreshDetail();
        });
        return;
      case 'start-build':
        await startBuildChange(d.id);
        message.success('已触发构建');
        break;
      case 'build-done':
        await buildDoneChange(d.id);
        message.success('构建完成');
        break;
      case 'regression-done':
        await regressionDoneChange(d.id);
        message.success('回归完成');
        break;
      case 'gate-pass':
        await gatePassChange(d.id);
        message.success('门禁校验通过');
        break;
      case 'merge':
        openPrompt(
          { title: '合入', placeholder: '请填写合入提交 sha（可留空）', required: false, okText: '合入' },
          async (v) => {
            await mergeChange(d.id, { mergedSha: v || undefined });
            message.success('已合入');
            await refreshDetail();
          },
        );
        return;
      case 'release':
        openPrompt({ title: '发布', placeholder: '请填写发布 Tag', okText: '发布' }, async (v) => {
          await releaseChange(d.id, { tag: v });
          message.success(`已发布（Tag：${v}）`);
          await refreshDetail();
        });
        return;
      case 'abandon':
        openPrompt(
          { title: '废弃变更单', placeholder: '请填写废弃原因', okText: '废弃', danger: true },
          async (v) => {
            await abandonChange(d.id, v);
            message.success('已废弃');
            await refreshDetail();
          },
        );
        return;
      case 'backflow-done':
        await backflowDoneChange(d.id);
        message.success('已标记回流完成');
        break;
    }
    await refreshDetail();
  } catch {
    // 取消或错误：request 层已统一弹错
  }
}

async function onBackflowDone(row: { id: string }) {
  try {
    await backflowDoneChange(row.id);
    message.success('已标记回流完成');
    await Promise.all([loadBackflows(), loadList(), loadOverview()]);
    if (detail.value && detail.value.id === row.id) detail.value = await getChange(row.id);
  } catch {
    // 拦截器统一提示
  }
}

// —— 样式映射（antdv 用颜色值而非 EP 的 type 枚举） ——
function statusTagColor(s: string) {
  if (s === 'RELEASED' || s === 'MERGED') return 'green';
  if (s === 'ABANDONED') return 'red';
  if (s === 'IN_REVIEW' || s === 'REGRESSION') return 'orange';
  return 'default';
}
function typeTagColor(t: string) {
  if (t === 'HOTFIX') return 'red';
  if (t === 'BUGFIX') return 'blue';
  if (t === 'FEATURE') return 'orange';
  return 'default';
}
function riskTagColor(r: string) {
  if (r === 'HIGH') return 'red';
  if (r === 'MEDIUM') return 'orange';
  return 'green';
}
const TIMELINE_COLOR: Record<string, string> = {
  merge: 'green',
  release: 'green',
  approve: 'green',
  abandon: 'red',
  'reject-review': 'red',
  submit: 'blue',
  'start-build': 'blue',
  create: 'blue',
};
function timelineColor(a: string) {
  return TIMELINE_COLOR[a] ?? 'orange';
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
  window.addEventListener('resize', resizeChart);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', resizeChart);
  trendChart?.dispose();
});

function resizeChart() {
  trendChart?.resize();
}
</script>

<style scoped>
/* ============================================================
   变更流转 — Apple 式重设计
   核心：大数字叙事 + 流转管道可视化 + 无卡片堆叠 + 大量留白
   ============================================================ */

.change-view {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* —— 入场动效：面板依次浮现 —— */
@keyframes bt-rise {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: none; }
}
.change-view > * {
  animation: bt-rise 0.5s cubic-bezier(0.22, 1, 0.36, 1) both;
}
.change-view > *:nth-child(2) { animation-delay: 0.05s; }
.change-view > *:nth-child(3) { animation-delay: 0.1s; }
.change-view > *:nth-child(4) { animation-delay: 0.15s; }
.change-view > *:nth-child(5) { animation-delay: 0.2s; }
.change-view > *:nth-child(6) { animation-delay: 0.25s; }
@media (prefers-reduced-motion: reduce) {
  .change-view > * { animation: none; }
}

/* —— Hero 页头 —— */
.hero {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
}
.hero-title {
  margin: 0;
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: #1d1d1f;
}
.hero-sub {
  margin: 6px 0 0;
  font-size: 13px;
  color: #86868b;
}
.bt-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* —— 面板基底：无描边卡片 + 大圆角 + 呼吸感阴影 —— */
.bt-panel {
  background: #ffffff;
  border-radius: 18px;
  border: 1px solid rgba(0, 0, 0, 0.04);
  box-shadow:
    0 1px 3px rgba(0, 0, 0, 0.03),
    0 12px 32px rgba(15, 23, 42, 0.05);
  overflow: hidden;
}

.panel-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 18px 24px 0;
}
.panel-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
  color: #1d1d1f;
}
.panel-hint {
  font-size: 12px;
  color: #aeaeb2;
}
.panel-hint.danger {
  color: #dc2626;
  font-weight: 500;
}

/* 面板内表格：与面板头部留白对齐 */
.panel-table {
  margin-top: 8px;
}
.panel-table :deep(.ant-table) {
  background: transparent;
}
.panel-table :deep(.ant-table-thead > tr > th) {
  background: transparent;
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.03em;
  color: #86868b;
}
.panel-table :deep(.ant-table-tbody > tr > td) {
  border-bottom: 1px solid #f2f2f7;
}
.panel-table :deep(.ant-tag) {
  border-radius: 999px;
  border: none;
  font-weight: 500;
}
.panel-table :deep(.ant-pagination) {
  padding: 0 24px;
}

/* —— 指标条：大数字 + 细分隔线 —— */
.stat-strip {
  display: flex;
  padding: 26px 12px;
}
.stat-item {
  flex: 1;
  text-align: center;
  padding: 0 12px;
  min-width: 0;
}
.stat-item + .stat-item {
  border-left: 1px solid #f0f0f4;
}
.stat-value {
  font-size: 34px;
  font-weight: 700;
  line-height: 1.1;
  letter-spacing: -0.02em;
  color: #1d1d1f;
  font-variant-numeric: tabular-nums;
}
.stat-value.warn {
  color: #ff9f0a;
}
.stat-label {
  margin-top: 8px;
  font-size: 12px;
  letter-spacing: 0.04em;
  color: #86868b;
  white-space: nowrap;
}

/* —— 流转管道 —— */
.pipeline {
  display: flex;
  align-items: flex-start;
  padding: 20px 24px 24px;
}
.pipe-node {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  flex: 0 0 auto;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.pipe-dot {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  background: #f5f5f7;
  color: #aeaeb2;
  border: 1.5px solid #e8e8ed;
  transition: all 0.2s cubic-bezier(0.22, 1, 0.36, 1);
}
.pipe-node:hover .pipe-dot {
  transform: translateY(-2px);
  border-color: #c7c7cc;
}
.pipe-node.active .pipe-dot {
  background: #3b8cff;
  border-color: #3b8cff;
  color: #ffffff;
  box-shadow: 0 4px 14px rgba(59, 140, 255, 0.35);
}
.pipe-node.selected .pipe-dot {
  box-shadow:
    0 0 0 4px rgba(59, 140, 255, 0.18),
    0 4px 14px rgba(59, 140, 255, 0.35);
}
.pipe-node.selected:not(.active) .pipe-dot {
  border-color: #3b8cff;
  color: #3b8cff;
  box-shadow: 0 0 0 4px rgba(59, 140, 255, 0.18);
}
.pipe-link {
  flex: 1;
  height: 2px;
  min-width: 12px;
  margin-top: 19px;
  background: #ececf0;
  border-radius: 1px;
}
.pipe-label {
  font-size: 11px;
  color: #86868b;
  white-space: nowrap;
  transition: color 0.2s ease;
}
.pipe-node.active .pipe-label,
.pipe-node.selected .pipe-label {
  color: #1d1d1f;
  font-weight: 600;
}

/* —— 趋势图 —— */
.mini-legend {
  display: flex;
  gap: 14px;
}
.lg {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #86868b;
}
.lg-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.trend-wrap {
  position: relative;
}
.chart {
  height: 260px;
}
.trend-empty {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  background: rgba(255, 255, 255, 0.65);
  backdrop-filter: blur(2px);
}
.trend-empty-title {
  font-size: 14px;
  font-weight: 600;
  color: #6e6e73;
}
.trend-empty-sub {
  font-size: 12px;
  color: #aeaeb2;
}

/* —— 徽标 / 状态点 —— */
.count-badge {
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: 999px;
  background: #fff1f0;
  color: #dc2626;
  font-size: 12px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-variant-numeric: tabular-nums;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 13px;
  color: #1d1d1f;
}
.sp-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex: 0 0 auto;
}

.list-filter {
  display: flex;
  gap: 8px;
}

/* —— 空态 —— */
.table-empty {
  padding: 48px 0 56px;
  text-align: center;
}
.table-empty-title {
  font-size: 14px;
  font-weight: 600;
  color: #6e6e73;
}
.table-empty-sub {
  margin-top: 6px;
  font-size: 12px;
  color: #aeaeb2;
}

/* —— 详情抽屉内 —— */
.branch-code {
  background: #f5f5f7;
  border: 1px solid #ececf0;
  padding: 1px 8px;
  border-radius: 6px;
  font-size: 12px;
  color: #2b7be6;
}

.action-bar { display: flex; flex-wrap: wrap; gap: 8px; }
.section-title { margin: 8px 0 12px; font-size: 14px; color: #1d1d1f; }
.dim { color: #86868b; font-size: 12px; }
.log-comment {
  margin-top: 4px;
  padding: 6px 10px;
  background: #f5f5f7;
  border-radius: 8px;
  font-size: 12px;
  color: #48484a;
}
.log-time {
  margin-top: 2px;
  font-size: 12px;
  color: #aeaeb2;
  font-variant-numeric: tabular-nums;
}
.mb16 { margin-bottom: 16px; }

/* 表格内编号入口 */
.cell-link {
  padding: 0;
  height: auto;
  font-weight: 600;
}

/* antd 按钮无语义色，用自定义类保留原状态机配色 */
.action-bar .act-success.ant-btn-primary {
  background: #16a34a;
  border-color: #16a34a;
}
.action-bar .act-success.ant-btn-primary:hover {
  background: #15803d;
  border-color: #15803d;
}
.action-bar .act-warning.ant-btn-primary {
  background: #ea580c;
  border-color: #ea580c;
}
.action-bar .act-warning.ant-btn-primary:hover {
  background: #c2410c;
  border-color: #c2410c;
}
.action-bar .act-danger-text {
  color: #dc2626;
  border-color: #fecaca;
}
.action-bar .act-danger-text:hover {
  color: #b91c1c;
  border-color: #fca5a5;
}
</style>
