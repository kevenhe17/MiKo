<template>
  <a-spin :spinning="loading">
    <div class="bug-detail">
      <div class="bt-toolbar">
        <div>
          <h3 class="bt-page-title">
            {{ bug?.code ?? '' }}
            <span class="title-text">{{ bug?.title ?? '' }}</span>
          </h3>
          <p class="bt-page-sub">缺陷全生命周期与操作留痕</p>
        </div>
        <a-button @click="router.push('/bugs')">返回列表</a-button>
      </div>

      <template v-if="bug">
        <a-row :gutter="16">
          <!-- 左列：详情 + 操作 -->
          <a-col :span="15">
            <a-card :bordered="false" class="mb16" title="缺陷信息">
              <a-descriptions :column="2" bordered size="middle">
                <a-descriptions-item label="状态">
                  <a-tag :color="STATUS_BADGE[bug.status]?.color">
                    {{ STATUS_LABELS[bug.status] }}
                  </a-tag>
                </a-descriptions-item>
                <a-descriptions-item label="严重度">
                  <a-tag :color="SEVERITY_BADGE[bug.severity]?.color">
                    {{ SEVERITY_LABELS[bug.severity] }}
                  </a-tag>
                </a-descriptions-item>
                <a-descriptions-item label="优先级">{{ bug.priority || '-' }}</a-descriptions-item>
                <a-descriptions-item label="模块">{{ bug.module || '-' }}</a-descriptions-item>
                <a-descriptions-item label="环境">{{ bug.environment || '-' }}</a-descriptions-item>
                <a-descriptions-item label="所属项目">
                  {{ bug.project?.name }}（{{ bug.project?.code }}）
                </a-descriptions-item>
                <a-descriptions-item label="处理人">{{ userName(bug.owner) }}</a-descriptions-item>
                <a-descriptions-item label="修复人">{{ userName(bug.fixer) }}</a-descriptions-item>
                <a-descriptions-item label="关联需求">
                  {{ bug.requirement ? `${bug.requirement.code} ${bug.requirement.title}` : '-' }}
                </a-descriptions-item>
                <a-descriptions-item label="关联用例">
                  {{ bug.case ? `${bug.case.module} / ${bug.case.title}` : '-' }}
                </a-descriptions-item>
              </a-descriptions>

              <a-divider orientation="left">复现信息</a-divider>
              <div class="field"><b>复现步骤</b><pre>{{ bug.steps }}</pre></div>
              <div class="field"><b>期望结果</b><pre>{{ bug.expected }}</pre></div>
              <div class="field"><b>实际结果</b><pre>{{ bug.actual }}</pre></div>

              <template v-if="bug.rootCause || bug.fixDesc || bug.impact">
                <a-divider orientation="left">修复说明</a-divider>
                <div class="field"><b>原因分析</b><pre>{{ bug.rootCause }}</pre></div>
                <div class="field"><b>修复说明</b><pre>{{ bug.fixDesc }}</pre></div>
                <div class="field"><b>影响评估</b><pre>{{ bug.impact }}</pre></div>
              </template>
            </a-card>

            <!-- 操作区：按钮集完全由状态机推导（visibleActions） -->
            <a-card :bordered="false" class="mb16" title="操作">
              <div v-if="actions.length" class="action-bar">
                <template v-for="action in actions" :key="action">
                  <a-button
                    v-if="action === 'assign'"
                    type="primary"
                    @click="assignVisible = true"
                  >分派</a-button>
                  <a-button
                    v-else-if="action === 'start'"
                    type="primary"
                    :loading="acting"
                    @click="doAction(() => startBug(bug!.id))"
                  >开始处理</a-button>
                  <a-button
                    v-else-if="action === 'fix'"
                    type="primary"
                    @click="fixVisible = true"
                  >填写修复</a-button>
                  <a-button
                    v-else-if="action === 'verify'"
                    type="primary"
                    class="act-success"
                    :loading="acting"
                    @click="doAction(() => verifyBug(bug!.id, { passed: true }))"
                  >回归通过</a-button>
                  <a-button
                    v-else-if="action === 'verify-fail'"
                    type="primary"
                    class="act-warning"
                    @click="verifyFailVisible = true"
                  >回归失败</a-button>
                  <a-button
                    v-else-if="action === 'close'"
                    @click="closeVisible = true"
                  >关闭</a-button>
                  <a-button
                    v-else-if="action === 'reopen'"
                    type="primary"
                    class="act-warning"
                    @click="reopenVisible = true"
                  >重开</a-button>
                  <a-button
                    v-else-if="action === 'reject'"
                    danger
                    @click="rejectVisible = true"
                  >拒绝</a-button>
                </template>
              </div>
              <a-empty
                v-else
                description="当前状态为终态或当前角色无可执行操作"
                :image="Empty.PRESENTED_IMAGE_SIMPLE"
              />
            </a-card>

            <!-- 附件区：缩略图点击放大（预览大图） -->
            <a-card :bordered="false" :title="`附件（${bug.attachments.length}）`">
              <div v-if="bug.attachments.length" class="thumbs">
                <a-image
                  v-for="att in bug.attachments"
                  :key="att.id"
                  :src="`/${att.filepath}`"
                  :width="120"
                  :height="90"
                  class="thumb"
                />
              </div>
              <a-empty v-else description="暂无附件" :image="Empty.PRESENTED_IMAGE_SIMPLE" />
            </a-card>
          </a-col>

          <!-- 右列：时间轴 -->
          <a-col :span="9">
            <a-card :bordered="false" title="操作时间轴">
              <a-timeline v-if="bug.logs.length">
                <a-timeline-item
                  v-for="log in bug.logs"
                  :key="log.id"
                  :color="timelineColor(log.action)"
                >
                  <div>
                    <b>{{ userName(log.operator) }}</b> 执行「{{ ACTION_LABELS[log.action as BugAction] ?? log.action }}」
                  </div>
                  <div class="log-status">
                    {{ STATUS_LABELS[log.fromStatus as BugStatus] ?? log.fromStatus }}
                    →
                    {{ STATUS_LABELS[log.toStatus as BugStatus] ?? log.toStatus }}
                  </div>
                  <div v-if="log.comment" class="log-comment">{{ log.comment }}</div>
                  <div class="log-time">{{ formatTime(log.createdAt) }}</div>
                </a-timeline-item>
              </a-timeline>
              <a-empty v-else description="暂无操作记录" :image="Empty.PRESENTED_IMAGE_SIMPLE" />
            </a-card>
          </a-col>
        </a-row>

        <!-- 分派 -->
        <a-modal
          v-model:open="assignVisible"
          title="分派缺陷"
          :width="440"
          :confirm-loading="acting"
          ok-text="分派"
          cancel-text="取消"
          :ok-button-props="{ disabled: !assignOwnerId }"
          @ok="submitAssign"
        >
          <a-form :label-col="{ flex: '80px' }">
            <a-form-item label="处理人" required>
              <a-select
                v-model:value="assignOwnerId"
                placeholder="选择处理人"
                :options="userOptions"
                show-search
                option-filter-prop="label"
              />
            </a-form-item>
            <a-form-item label="备注">
              <a-textarea v-model:value="assignComment" :rows="2" placeholder="可选" />
            </a-form-item>
          </a-form>
        </a-modal>

        <!-- 填写修复（三件套必填） -->
        <a-modal
          v-model:open="fixVisible"
          title="填写修复"
          :width="520"
          :confirm-loading="acting"
          ok-text="提交"
          cancel-text="取消"
          @ok="submitFix"
        >
          <a-form ref="fixFormRef" :model="fixForm" :rules="fixRules" :label-col="{ flex: '90px' }" class="dlg-form">
            <a-form-item label="原因分析" name="rootCause">
              <a-textarea v-model:value="fixForm.rootCause" :rows="2" />
            </a-form-item>
            <a-form-item label="修复说明" name="fixDesc">
              <a-textarea v-model:value="fixForm.fixDesc" :rows="2" />
            </a-form-item>
            <a-form-item label="影响评估" name="impact">
              <a-textarea v-model:value="fixForm.impact" :rows="2" />
            </a-form-item>
          </a-form>
        </a-modal>

        <!-- 回归失败（必填原因） -->
        <a-modal
          v-model:open="verifyFailVisible"
          title="回归失败（将重开为处理中）"
          :width="440"
          :confirm-loading="acting"
          ok-text="确认失败"
          cancel-text="取消"
          :ok-button-props="{ disabled: !verifyFailComment.trim(), danger: true }"
          @ok="submitVerifyFail"
        >
          <a-textarea v-model:value="verifyFailComment" :rows="3" placeholder="请填写失败原因（必填）" />
        </a-modal>

        <!-- 关闭 -->
        <a-modal
          v-model:open="closeVisible"
          title="关闭缺陷"
          :width="440"
          :confirm-loading="acting"
          ok-text="关闭"
          cancel-text="取消"
          @ok="submitClose"
        >
          <a-textarea
            v-model:value="closeComment"
            :rows="2"
            placeholder="备注（可选，默认「验证通过，关闭缺陷」）"
          />
        </a-modal>

        <!-- 重开（必填原因） -->
        <a-modal
          v-model:open="reopenVisible"
          title="重开缺陷"
          :width="440"
          :confirm-loading="acting"
          ok-text="重开"
          cancel-text="取消"
          :ok-button-props="{ disabled: !reopenComment.trim() }"
          @ok="submitReopen"
        >
          <a-textarea v-model:value="reopenComment" :rows="3" placeholder="请填写重开原因（必填）" />
        </a-modal>

        <!-- 拒绝（必填原因） -->
        <a-modal
          v-model:open="rejectVisible"
          title="拒绝缺陷"
          :width="440"
          :confirm-loading="acting"
          ok-text="拒绝"
          cancel-text="取消"
          :ok-button-props="{ disabled: !rejectReason.trim(), danger: true }"
          @ok="submitReject"
        >
          <a-textarea v-model:value="rejectReason" :rows="3" placeholder="请填写拒绝原因（必填）" />
        </a-modal>
      </template>
    </div>
  </a-spin>
</template>

<script setup lang="ts">
// v0.2 · 迁移到 Ant Design Vue：Spin / Row-Col / Card / Descriptions / Timeline / Modal / Image
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { App, Empty } from 'ant-design-vue';
import {
  getBug,
  assignBug,
  startBug,
  fixBug,
  verifyBug,
  closeBug,
  reopenBug,
  rejectBug,
  type BugDetail,
} from '../../api/bug';
import { listUsers, type UserOption } from '../../api/user';
import { useUserStore } from '../../stores/user';
import {
  visibleActions,
  ACTION_LABELS,
  STATUS_LABELS,
  SEVERITY_LABELS,
  type BugAction,
  type BugStatus,
} from '../../constants/bug-status.machine';

const { message } = App.useApp();
const route = useRoute();
const router = useRouter();
const userStore = useUserStore();

const loading = ref(false);
const acting = ref(false);
const bug = ref<BugDetail | null>(null);
const users = ref<UserOption[]>([]);

// 按钮集：状态机推导；verify 拆「通过 / 失败」两个入口
const actions = computed<(BugAction | 'verify-fail')[]>(() => {
  if (!bug.value || !userStore.user) return [];
  const list = visibleActions(bug.value.status, userStore.user.role);
  return list.flatMap((a) => (a === 'verify' ? (['verify', 'verify-fail'] as const) : [a]));
});

const userOptions = computed(() =>
  users.value.map((u) => ({ label: u.realname || u.username, value: Number(u.id) })),
);

// —— 弹窗状态 ——
const assignVisible = ref(false);
const assignOwnerId = ref<number | undefined>(undefined);
const assignComment = ref('');
const fixVisible = ref(false);
const fixFormRef = ref();
const fixForm = reactive({ rootCause: '', fixDesc: '', impact: '' });
const fixRules = {
  rootCause: [{ required: true, message: '原因分析不能为空', trigger: 'change' }],
  fixDesc: [{ required: true, message: '修复说明不能为空', trigger: 'change' }],
  impact: [{ required: true, message: '影响评估不能为空', trigger: 'change' }],
};
const verifyFailVisible = ref(false);
const verifyFailComment = ref('');
const closeVisible = ref(false);
const closeComment = ref('');
const reopenVisible = ref(false);
const reopenComment = ref('');
const rejectVisible = ref(false);
const rejectReason = ref('');

const STATUS_BADGE: Record<string, { color: string }> = {
  NEW: { color: '#909399' },
  ASSIGNED: { color: '#409EFF' },
  IN_PROGRESS: { color: '#E6A23C' },
  FIXED: { color: '#13C2C2' },
  VERIFIED: { color: '#67C23A' },
  CLOSED: { color: '#606266' },
};
const SEVERITY_BADGE: Record<string, { color: string }> = {
  BLOCKER: { color: '#F56C6C' },
  CRITICAL: { color: '#E6711B' },
  MAJOR: { color: '#E6A23C' },
  MINOR: { color: '#909399' },
};
// 时间轴节点色：antdv 用颜色值而非 EP 的 type
const TIMELINE_COLOR: Record<string, string> = {
  create: 'blue',
  assign: 'blue',
  start: 'blue',
  fix: 'green',
  verify: 'green',
  close: 'gray',
  reopen: 'orange',
  reject: 'red',
};

function timelineColor(action: string) {
  return TIMELINE_COLOR[action] ?? 'blue';
}

async function load() {
  loading.value = true;
  try {
    bug.value = await getBug(route.params.id as string);
  } finally {
    loading.value = false;
  }
}

/** 统一执行流转：成功后以返回值即时刷新页面（无刷新） */
async function doAction(fn: () => Promise<BugDetail>) {
  acting.value = true;
  try {
    bug.value = await fn();
    message.success('操作成功');
  } catch {
    // 拦截器统一提示（含 403/400 双防线语义）
  } finally {
    acting.value = false;
  }
}

function submitAssign() {
  if (!assignOwnerId.value || !bug.value) return;
  const id = bug.value.id;
  const ownerId = assignOwnerId.value;
  void doAction(() => assignBug(id, { ownerId, comment: assignComment.value || undefined }));
  assignVisible.value = false;
}

async function submitFix() {
  try {
    await fixFormRef.value?.validate();
  } catch {
    return;
  }
  if (!bug.value) return;
  void doAction(() => fixBug(bug.value!.id, { ...fixForm }));
  fixVisible.value = false;
}

function submitVerifyFail() {
  if (!bug.value) return;
  void doAction(() => verifyBug(bug.value!.id, { passed: false, comment: verifyFailComment.value }));
  verifyFailVisible.value = false;
}

function submitClose() {
  if (!bug.value) return;
  void doAction(() => closeBug(bug.value!.id, closeComment.value || undefined));
  closeVisible.value = false;
}

function submitReopen() {
  if (!bug.value) return;
  void doAction(() => reopenBug(bug.value!.id, reopenComment.value));
  reopenVisible.value = false;
}

function submitReject() {
  if (!bug.value) return;
  void doAction(() => rejectBug(bug.value!.id, rejectReason.value));
  rejectVisible.value = false;
}

function userName(u: { username: string; realname: string } | null | undefined) {
  return u ? u.realname || u.username : '-';
}

function formatTime(value: string) {
  return new Date(value).toLocaleString('zh-CN', { hour12: false });
}

onMounted(async () => {
  users.value = await listUsers();
  await load();
});
</script>

<style scoped>
.title-text {
  font-size: 15px;
  font-weight: normal;
  color: var(--bt-text-body);
  margin-left: 8px;
}
.mb16 {
  margin-bottom: 16px;
}
.field {
  margin-bottom: 8px;
}
.field pre {
  margin: 4px 0 0;
  white-space: pre-wrap;
  word-break: break-word;
  background: var(--bt-gradient-soft);
  padding: 10px 12px;
  border-radius: var(--bt-radius-sm);
  font-family: inherit;
  color: var(--bt-text-body);
}
.action-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

/* antd 按钮无语义色（success/warning），用自定义类保留原状态机配色 */
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

.thumbs {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}
.thumb {
  border-radius: var(--bt-radius-sm);
  border: 1px solid var(--bt-border);
  overflow: hidden;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.thumb:hover {
  transform: translateY(-2px);
  box-shadow: var(--bt-shadow-card-hover);
}

.log-status {
  font-size: 12px;
  color: var(--bt-text-muted);
}
.log-comment {
  font-size: 12px;
  color: var(--bt-text-body);
  margin-top: 2px;
}
.log-time {
  font-size: 12px;
  color: var(--bt-text-muted);
  margin-top: 2px;
  font-variant-numeric: tabular-nums;
}
</style>
