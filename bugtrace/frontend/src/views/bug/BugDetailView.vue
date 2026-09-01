<template>
  <div v-loading="loading" class="bug-detail">
    <div class="bt-toolbar">
      <div>
        <h3 class="bt-page-title">
          {{ bug?.code ?? '' }}
          <span class="title-text">{{ bug?.title ?? '' }}</span>
        </h3>
        <p class="bt-page-sub">缺陷全生命周期与操作留痕</p>
      </div>
      <el-button @click="router.push('/bugs')">返回列表</el-button>
    </div>

    <template v-if="bug">
      <el-row :gutter="16">
        <!-- 左列：详情 + 操作 -->
        <el-col :span="15">
          <el-card class="mb16">
            <template #header>缺陷信息</template>
            <el-descriptions :column="2" border>
              <el-descriptions-item label="状态">
                <el-tag :color="STATUS_BADGE[bug.status]?.color" :style="{ color: '#fff', border: 'none' }">
                  {{ STATUS_LABELS[bug.status] }}
                </el-tag>
              </el-descriptions-item>
              <el-descriptions-item label="严重度">
                <el-tag :color="SEVERITY_BADGE[bug.severity]?.color" :style="{ color: '#fff', border: 'none' }">
                  {{ SEVERITY_LABELS[bug.severity] }}
                </el-tag>
              </el-descriptions-item>
              <el-descriptions-item label="优先级">{{ bug.priority || '-' }}</el-descriptions-item>
              <el-descriptions-item label="模块">{{ bug.module || '-' }}</el-descriptions-item>
              <el-descriptions-item label="环境">{{ bug.environment || '-' }}</el-descriptions-item>
              <el-descriptions-item label="所属项目">{{ bug.project?.name }}（{{ bug.project?.code }}）</el-descriptions-item>
              <el-descriptions-item label="处理人">{{ userName(bug.owner) }}</el-descriptions-item>
              <el-descriptions-item label="修复人">{{ userName(bug.fixer) }}</el-descriptions-item>
              <el-descriptions-item label="关联需求">
                {{ bug.requirement ? `${bug.requirement.code} ${bug.requirement.title}` : '-' }}
              </el-descriptions-item>
              <el-descriptions-item label="关联用例">
                {{ bug.case ? `${bug.case.module} / ${bug.case.title}` : '-' }}
              </el-descriptions-item>
            </el-descriptions>

            <el-divider content-position="left">复现信息</el-divider>
            <div class="field"><b>复现步骤</b><pre>{{ bug.steps }}</pre></div>
            <div class="field"><b>期望结果</b><pre>{{ bug.expected }}</pre></div>
            <div class="field"><b>实际结果</b><pre>{{ bug.actual }}</pre></div>

            <template v-if="bug.rootCause || bug.fixDesc || bug.impact">
              <el-divider content-position="left">修复说明</el-divider>
              <div class="field"><b>原因分析</b><pre>{{ bug.rootCause }}</pre></div>
              <div class="field"><b>修复说明</b><pre>{{ bug.fixDesc }}</pre></div>
              <div class="field"><b>影响评估</b><pre>{{ bug.impact }}</pre></div>
            </template>
          </el-card>

          <!-- 操作区：按钮集完全由状态机推导（visibleActions） -->
          <el-card class="mb16">
            <template #header>操作</template>
            <div v-if="actions.length" class="action-bar">
              <template v-for="action in actions" :key="action">
                <el-button
                  v-if="action === 'assign'"
                  type="primary"
                  @click="assignVisible = true"
                >分派</el-button>
                <el-button
                  v-else-if="action === 'start'"
                  type="primary"
                  :loading="acting"
                  @click="doAction(() => startBug(bug.id))"
                >开始处理</el-button>
                <el-button
                  v-else-if="action === 'fix'"
                  type="primary"
                  @click="fixVisible = true"
                >填写修复</el-button>
                <el-button
                  v-else-if="action === 'verify'"
                  type="success"
                  :loading="acting"
                  @click="doAction(() => verifyBug(bug.id, { passed: true }))"
                >回归通过</el-button>
                <el-button
                  v-else-if="action === 'verify-fail'"
                  type="warning"
                  @click="verifyFailVisible = true"
                >回归失败</el-button>
                <el-button
                  v-else-if="action === 'close'"
                  type="info"
                  @click="closeVisible = true"
                >关闭</el-button>
                <el-button
                  v-else-if="action === 'reopen'"
                  type="warning"
                  @click="reopenVisible = true"
                >重开</el-button>
                <el-button
                  v-else-if="action === 'reject'"
                  type="danger"
                  @click="rejectVisible = true"
                >拒绝</el-button>
              </template>
            </div>
            <el-empty v-else description="当前状态为终态或当前角色无可执行操作" :image-size="60" />
          </el-card>

          <!-- 附件区：缩略图点击放大（预览大图） -->
          <el-card>
            <template #header>附件（{{ bug.attachments.length }}）</template>
            <div v-if="bug.attachments.length" class="thumbs">
              <el-image
                v-for="att in bug.attachments"
                :key="att.id"
                :src="`/${att.filepath}`"
                fit="cover"
                :preview-src-list="bug.attachments.map((a) => `/${a.filepath}`)"
                preview-teleported
                class="thumb"
              />
            </div>
            <el-empty v-else description="暂无附件" :image-size="60" />
          </el-card>
        </el-col>

        <!-- 右列：时间轴 -->
        <el-col :span="9">
          <el-card>
            <template #header>操作时间轴</template>
            <el-timeline v-if="bug.logs.length">
              <el-timeline-item
                v-for="log in bug.logs"
                :key="log.id"
                :timestamp="formatTime(log.createdAt)"
                :type="TIMELINE_TYPE[log.action] ?? 'primary'"
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
              </el-timeline-item>
            </el-timeline>
            <el-empty v-else description="暂无操作记录" :image-size="60" />
          </el-card>
        </el-col>
      </el-row>

      <!-- 分派弹窗 -->
      <el-dialog v-model="assignVisible" title="分派缺陷" width="440px">
        <el-form label-width="80px">
          <el-form-item label="处理人" required>
            <el-select v-model="assignOwnerId" placeholder="选择处理人" style="width: 100%">
              <el-option v-for="u in users" :key="u.id" :label="u.realname || u.username" :value="Number(u.id)" />
            </el-select>
          </el-form-item>
          <el-form-item label="备注">
            <el-input v-model="assignComment" type="textarea" :rows="2" placeholder="可选" />
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="assignVisible = false">取消</el-button>
          <el-button type="primary" :disabled="!assignOwnerId" :loading="acting" @click="submitAssign">分派</el-button>
        </template>
      </el-dialog>

      <!-- 填写修复弹窗（三件套必填） -->
      <el-dialog v-model="fixVisible" title="填写修复" width="520px">
        <el-form ref="fixFormRef" :model="fixForm" :rules="fixRules" label-width="90px">
          <el-form-item label="原因分析" prop="rootCause">
            <el-input v-model="fixForm.rootCause" type="textarea" :rows="2" />
          </el-form-item>
          <el-form-item label="修复说明" prop="fixDesc">
            <el-input v-model="fixForm.fixDesc" type="textarea" :rows="2" />
          </el-form-item>
          <el-form-item label="影响评估" prop="impact">
            <el-input v-model="fixForm.impact" type="textarea" :rows="2" />
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="fixVisible = false">取消</el-button>
          <el-button type="primary" :loading="acting" @click="submitFix">提交</el-button>
        </template>
      </el-dialog>

      <!-- 回归失败弹窗（必填原因） -->
      <el-dialog v-model="verifyFailVisible" title="回归失败（将重开为处理中）" width="440px">
        <el-input v-model="verifyFailComment" type="textarea" :rows="3" placeholder="请填写失败原因（必填）" />
        <template #footer>
          <el-button @click="verifyFailVisible = false">取消</el-button>
          <el-button type="warning" :disabled="!verifyFailComment.trim()" :loading="acting" @click="submitVerifyFail">确认失败</el-button>
        </template>
      </el-dialog>

      <!-- 关闭弹窗 -->
      <el-dialog v-model="closeVisible" title="关闭缺陷" width="440px">
        <el-input v-model="closeComment" type="textarea" :rows="2" placeholder="备注（可选，默认「验证通过，关闭缺陷」）" />
        <template #footer>
          <el-button @click="closeVisible = false">取消</el-button>
          <el-button type="primary" :loading="acting" @click="submitClose">关闭</el-button>
        </template>
      </el-dialog>

      <!-- 重开弹窗（必填原因） -->
      <el-dialog v-model="reopenVisible" title="重开缺陷" width="440px">
        <el-input v-model="reopenComment" type="textarea" :rows="3" placeholder="请填写重开原因（必填）" />
        <template #footer>
          <el-button @click="reopenVisible = false">取消</el-button>
          <el-button type="warning" :disabled="!reopenComment.trim()" :loading="acting" @click="submitReopen">重开</el-button>
        </template>
      </el-dialog>

      <!-- 拒绝弹窗（必填原因） -->
      <el-dialog v-model="rejectVisible" title="拒绝缺陷" width="440px">
        <el-input v-model="rejectReason" type="textarea" :rows="3" placeholder="请填写拒绝原因（必填）" />
        <template #footer>
          <el-button @click="rejectVisible = false">取消</el-button>
          <el-button type="danger" :disabled="!rejectReason.trim()" :loading="acting" @click="submitReject">拒绝</el-button>
        </template>
      </el-dialog>
    </template>
  </div>
</template>

<script setup lang="ts">
// T3-6 · Bug 详情页：按「角色 × 状态」渲染操作按钮（状态机推导）+ 修复表单 + 时间轴 + 附件预览
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, type FormInstance, type FormRules } from 'element-plus';
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
  return list.flatMap((a) => (a === 'verify' ? ['verify', 'verify-fail'] as const : [a]));
});

// —— 弹窗状态 ——
const assignVisible = ref(false);
const assignOwnerId = ref<number | undefined>(undefined);
const assignComment = ref('');
const fixVisible = ref(false);
const fixFormRef = ref<FormInstance>();
const fixForm = reactive({ rootCause: '', fixDesc: '', impact: '' });
const fixRules: FormRules = {
  rootCause: [{ required: true, message: '原因分析不能为空', trigger: 'blur' }],
  fixDesc: [{ required: true, message: '修复说明不能为空', trigger: 'blur' }],
  impact: [{ required: true, message: '影响评估不能为空', trigger: 'blur' }],
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
const TIMELINE_TYPE: Record<string, 'primary' | 'success' | 'warning' | 'danger' | 'info'> = {
  create: 'primary',
  assign: 'primary',
  start: 'primary',
  fix: 'success',
  verify: 'success',
  close: 'info',
  reopen: 'warning',
  reject: 'danger',
};

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
    ElMessage.success('操作成功');
  } catch {
    // 拦截器统一提示（含 403/400 双防线语义）
  } finally {
    acting.value = false;
  }
}

function submitAssign() {
  if (!assignOwnerId.value || !bug.value) return;
  void doAction(() =>
    assignBug(bug.value!.id, { ownerId: assignOwnerId.value, comment: assignComment.value || undefined }),
  );
  assignVisible.value = false;
}

async function submitFix() {
  const valid = await fixFormRef.value?.validate().catch(() => false);
  if (!valid || !bug.value) return;
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
.title-text { font-size: 15px; font-weight: normal; color: var(--bt-text-body); margin-left: 8px; }
.mb16 { margin-bottom: 16px; }
.field { margin-bottom: 8px; }
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
.action-bar { display: flex; flex-wrap: wrap; gap: 10px; }
.thumbs { display: flex; flex-wrap: wrap; gap: 12px; }
.thumb {
  width: 120px;
  height: 90px;
  border-radius: var(--bt-radius-sm);
  border: 1px solid var(--bt-border);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.thumb:hover {
  transform: translateY(-2px);
  box-shadow: var(--bt-shadow-card-hover);
}
.log-status { font-size: 12px; color: var(--bt-text-muted); }
.log-comment { font-size: 12px; color: var(--bt-text-body); margin-top: 2px; }
</style>
