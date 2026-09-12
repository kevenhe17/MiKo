<template>
  <div class="bug-create">
    <div class="bt-toolbar">
      <div>
        <h3 class="bt-page-title">提交缺陷</h3>
        <p class="bt-page-sub">复现信息越完整，定位越快</p>
      </div>
      <a-button @click="goBack">返回列表</a-button>
    </div>

    <a-form
      ref="formRef"
      :model="form"
      :rules="rules"
      :label-col="{ flex: '100px' }"
      class="bug-form"
    >
      <a-card :bordered="false" class="form-group" title="归属">
        <a-form-item label="所属项目" name="projectId">
          <a-select
            v-model:value="form.projectId"
            placeholder="选择项目"
            style="width: 320px"
            :options="projectOptions"
            @change="onProjectChange"
          />
        </a-form-item>

        <a-form-item label="关联需求" name="requirementId">
          <a-select
            v-model:value="form.requirementId"
            placeholder="可选"
            allow-clear
            style="width: 320px"
            :disabled="requirementFromCase"
            :options="requirementOptions"
          />
          <span v-if="requirementFromCase" class="hint">已按所选用例自动带出</span>
        </a-form-item>

        <a-form-item label="关联用例" name="caseId">
          <a-select
            v-model:value="form.caseId"
            placeholder="可选（已关联需求的用例优先）"
            allow-clear
            :disabled="!form.projectId"
            style="width: 320px"
            :options="caseOptions"
            show-search
            option-filter-prop="label"
            @change="onCaseChange"
          />
        </a-form-item>
      </a-card>

      <a-card :bordered="false" class="form-group" title="基本信息">
        <a-form-item label="标题" name="title">
          <a-input
            v-model:value="form.title"
            :maxlength="100"
            show-count
            placeholder="一句话描述缺陷"
          />
        </a-form-item>

        <a-form-item label="严重度" name="severity">
          <a-select
            v-model:value="form.severity"
            placeholder="选择严重度"
            style="width: 200px"
            :options="severityOptions"
          />
        </a-form-item>

        <a-form-item label="优先级" name="priority">
          <a-select
            v-model:value="form.priority"
            placeholder="可选，默认 P1"
            allow-clear
            style="width: 200px"
            :options="priorityOptions"
          />
        </a-form-item>

        <a-form-item label="模块" name="module">
          <a-input v-model:value="form.module" placeholder="如：登录模块" />
        </a-form-item>

        <a-form-item label="环境" name="environment">
          <a-input v-model:value="form.environment" placeholder="如：Chrome 120 / Windows 11" />
        </a-form-item>
      </a-card>

      <a-card :bordered="false" class="form-group" title="复现信息">
        <a-form-item label="复现步骤" name="steps">
          <a-textarea v-model:value="form.steps" :rows="4" placeholder="逐步描述复现操作" />
        </a-form-item>

        <a-form-item label="期望结果" name="expected">
          <a-textarea v-model:value="form.expected" :rows="2" placeholder="期望发生什么" />
        </a-form-item>

        <a-form-item label="实际结果" name="actual">
          <a-textarea v-model:value="form.actual" :rows="2" placeholder="实际发生了什么" />
        </a-form-item>
      </a-card>

      <a-card :bordered="false" class="form-group" title="截图">
        <a-form-item label="复现截图">
          <a-upload
            :custom-request="doUpload"
            accept=".png,.jpg,.jpeg"
            :show-upload-list="false"
            :disabled="!form.projectId"
            multiple
            class="shot-uploader"
          >
            <a-upload-dragger>
              <p class="ant-upload-drag-icon"><InboxOutlined /></p>
              <p class="ant-upload-text">拖拽截图到此处，或点击上传</p>
              <p class="ant-upload-hint">png / jpg / jpeg，单个 ≤5MB，可多选</p>
            </a-upload-dragger>
          </a-upload>
          <div v-if="!form.projectId" class="hint hint-block">请先选择所属项目</div>

          <div v-if="uploaded.length" class="thumbs">
            <div v-for="att in uploaded" :key="att.id" class="thumb-item">
              <a-image :src="att.url" :width="120" :height="90" class="thumb" />
              <a-button type="link" danger size="small" @click="removeShot(att)">删除</a-button>
            </div>
          </div>
        </a-form-item>
      </a-card>

      <div class="submit-bar">
        <a-button size="large" @click="goBack">取消</a-button>
        <a-button type="primary" size="large" :loading="submitting" @click="submit">
          提 交
        </a-button>
      </div>
    </a-form>
  </div>
</template>

<script setup lang="ts">
// v0.2 · 迁移到 Ant Design Vue：Form / Card / Upload(customRequest) / Select / Image
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { App } from 'ant-design-vue';
import { InboxOutlined } from '@ant-design/icons-vue';
import { createBug } from '../../api/bug';
import { listProjects, type Project } from '../../api/project';
import { listRequirements, type Requirement } from '../../api/requirement';
import { listCases, type TestCase } from '../../api/test-case';
import { uploadAttachment, type Attachment } from '../../api/attachment';

/** antdv customRequest 的最小入参（只用到 file 与两个回调） */
interface UploadOpts {
  file: File;
  onSuccess?: (body: unknown) => void;
  onError?: (err: Error) => void;
}

const { message } = App.useApp();
const router = useRouter();

const projects = ref<Project[]>([]);
const requirements = ref<Requirement[]>([]);
const cases = ref<TestCase[]>([]);
const uploaded = ref<Attachment[]>([]);
const submitting = ref(false);

const formRef = ref();
const form = reactive({
  projectId: undefined as number | undefined,
  requirementId: undefined as number | undefined,
  caseId: undefined as number | undefined,
  title: '',
  severity: '' as string,
  priority: undefined as string | undefined,
  module: '',
  environment: '',
  steps: '',
  expected: '',
  actual: '',
});

// 必填六项（任务书）+ environment（后端 DTO 同为必填，缺省会被 400 拦截）
const rules = {
  projectId: [{ required: true, message: '请选择所属项目', trigger: 'change' }],
  title: [{ required: true, message: '请输入标题', trigger: 'change' }],
  severity: [{ required: true, message: '请选择严重度', trigger: 'change' }],
  module: [{ required: true, message: '请输入模块', trigger: 'change' }],
  environment: [{ required: true, message: '请输入环境', trigger: 'change' }],
  steps: [{ required: true, message: '请输入复现步骤', trigger: 'change' }],
  expected: [{ required: true, message: '请输入期望结果', trigger: 'change' }],
  actual: [{ required: true, message: '请输入实际结果', trigger: 'change' }],
};

const severityOptions = [
  { label: '致命 BLOCKER', value: 'BLOCKER' },
  { label: '严重 CRITICAL', value: 'CRITICAL' },
  { label: '一般 MAJOR', value: 'MAJOR' },
  { label: '轻微 MINOR', value: 'MINOR' },
];
const priorityOptions = [
  { label: 'P0', value: 'P0' },
  { label: 'P1', value: 'P1' },
  { label: 'P2', value: 'P2' },
];

const projectOptions = computed(() =>
  projects.value.map((p) => ({ label: `${p.name}（${p.code}）`, value: Number(p.id) })),
);
const requirementOptions = computed(() =>
  requirements.value.map((r) => ({ label: `${r.code} ${r.title}`, value: Number(r.id) })),
);
const caseOptions = computed(() =>
  sortedCases.value.map((c) => ({
    label: `${c.requirement ? '★ ' : ''}${c.module} / ${c.title}`,
    value: Number(c.id),
  })),
);

// 已关联需求的用例优先展示（★ 标记）
const sortedCases = computed(() =>
  [...cases.value].sort((a, b) => Number(!!b.requirement) - Number(!!a.requirement)),
);

// 选择了带需求的用例 → requirement 自动带出且锁定
const requirementFromCase = computed(() => {
  const c = cases.value.find((item) => Number(item.id) === form.caseId);
  return !!c?.requirementId;
});

function onProjectChange() {
  form.requirementId = undefined;
  form.caseId = undefined;
  void loadProjectData();
}

async function loadProjectData() {
  if (!form.projectId) return;
  const projectId = form.projectId;
  const [reqPage, casePage] = await Promise.all([
    listRequirements({ projectId, page: 1, pageSize: 100 }),
    listCases({ projectId, page: 1, pageSize: 100 }),
  ]);
  requirements.value = reqPage.list;
  cases.value = casePage.list;
}

function onCaseChange() {
  const c = cases.value.find((item) => Number(item.id) === form.caseId);
  if (c?.requirementId) {
    form.requirementId = Number(c.requirementId); // 读用例上的 requirement 自动带出
  }
}

/** 即传即入库：成功 push 缩略图；失败提示但不阻塞表单 */
async function doUpload(options: UploadOpts) {
  if (!form.projectId) {
    message.warning('请先选择所属项目');
    return;
  }
  try {
    const att = await uploadAttachment(options.file, { projectId: form.projectId, targetType: 'bug' });
    uploaded.value.push(att);
    options.onSuccess?.(att);
  } catch (err) {
    // 拦截器已提示（类型/超限 400 等），此处不阻塞提交
    options.onError?.(err as Error);
  }
}

/** MVP 简化：删除 = 前端隐藏 + 提交时忽略（不调后端 DELETE） */
function removeShot(att: Attachment) {
  uploaded.value = uploaded.value.filter((item) => item.id !== att.id);
}

async function submit() {
  try {
    await formRef.value?.validate();
  } catch {
    message.warning('请补全必填项');
    return;
  }
  submitting.value = true;
  try {
    const bug = await createBug({
      projectId: form.projectId as number,
      title: form.title,
      severity: form.severity,
      priority: form.priority || undefined,
      module: form.module,
      environment: form.environment,
      steps: form.steps,
      expected: form.expected,
      actual: form.actual,
      requirementId: form.requirementId || undefined,
      caseId: form.caseId || undefined,
      attachmentIds: uploaded.value.map((a) => Number(a.id)),
    });
    message.success(`提单成功：${bug.code}`);
    void router.push(`/bugs/${bug.id}`);
  } catch {
    // 拦截器统一提示
  } finally {
    submitting.value = false;
  }
}

function goBack() {
  void router.push('/bugs');
}

onMounted(async () => {
  projects.value = (await listProjects({ page: 1, pageSize: 100 })).list;
});
</script>

<style scoped>
.bug-form {
  max-width: 760px;
}
.form-group {
  margin-bottom: 16px;
}
/* 卡片分组标题：与 EP 版本的 header 视觉一致 */
.form-group :deep(.ant-card-head) {
  padding: 0 20px;
  min-height: 48px;
  font-weight: 600;
  font-size: 14px;
  color: var(--bt-text-title);
}
.form-group :deep(.ant-card-body) {
  padding: 20px 20px 4px;
}

.submit-bar {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding-top: 4px;
}

.hint {
  margin-left: 8px;
  color: var(--bt-text-muted);
  font-size: 12px;
}
.hint-block {
  display: block;
  margin: 6px 0 0;
}

.shot-uploader {
  width: 420px;
}
.shot-uploader :deep(.ant-upload-drag) {
  border-radius: var(--bt-radius-md);
  transition: border-color 0.2s ease, background 0.2s ease;
}
.shot-uploader :deep(.ant-upload-drag:hover) {
  border-color: var(--bt-primary);
  background: var(--bt-primary-bg);
}
/* 拖拽区文案压缩一档，避免比表单其它区域更抢眼 */
.shot-uploader :deep(.ant-upload-drag-icon) {
  margin-bottom: 4px;
}
.shot-uploader :deep(.ant-upload-text) {
  font-size: 13px;
}
.shot-uploader :deep(.ant-upload-hint) {
  font-size: 12px;
}

.thumbs {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 12px;
}
.thumb-item {
  text-align: center;
}
.thumb {
  border-radius: var(--bt-radius-sm);
  border: 1px solid var(--bt-border);
  display: block;
  overflow: hidden;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.thumb:hover {
  transform: translateY(-2px);
  box-shadow: var(--bt-shadow-card-hover);
}
</style>
