<template>
  <div class="bug-create">
    <div class="bt-toolbar">
      <div>
        <h3 class="bt-page-title">提交缺陷</h3>
        <p class="bt-page-sub">复现信息越完整，定位越快</p>
      </div>
      <el-button @click="goBack">返回列表</el-button>
    </div>

    <el-form ref="formRef" :model="form" :rules="rules" label-width="100px" class="bug-form">
      <el-card shadow="never" class="form-group">
        <template #header>归属</template>
        <el-form-item label="所属项目" prop="projectId">
          <el-select v-model="form.projectId" placeholder="选择项目" style="width: 320px" @change="onProjectChange">
            <el-option v-for="p in projects" :key="p.id" :label="`${p.name}（${p.code}）`" :value="Number(p.id)" />
          </el-select>
        </el-form-item>
        <el-form-item label="关联需求">
          <el-select v-model="form.requirementId" placeholder="可选" clearable style="width: 320px" :disabled="requirementFromCase">
            <el-option v-for="r in requirements" :key="r.id" :label="`${r.code} ${r.title}`" :value="Number(r.id)" />
          </el-select>
          <span v-if="requirementFromCase" class="hint">已按所选用例自动带出</span>
        </el-form-item>
        <el-form-item label="关联用例">
          <el-select
            v-model="form.caseId"
            placeholder="可选（已关联需求的用例优先）"
            clearable
            :disabled="!form.projectId"
            style="width: 320px"
            @change="onCaseChange"
          >
            <el-option
              v-for="c in sortedCases"
              :key="c.id"
              :label="`${c.requirement ? '★ ' : ''}${c.module} / ${c.title}`"
              :value="Number(c.id)"
            />
          </el-select>
        </el-form-item>
      </el-card>

      <el-card shadow="never" class="form-group">
        <template #header>基本信息</template>
        <el-form-item label="标题" prop="title">
          <el-input v-model="form.title" maxlength="100" show-word-limit placeholder="一句话描述缺陷" />
        </el-form-item>
        <el-form-item label="严重度" prop="severity">
          <el-select v-model="form.severity" placeholder="选择严重度" style="width: 200px">
            <el-option label="致命 BLOCKER" value="BLOCKER" />
            <el-option label="严重 CRITICAL" value="CRITICAL" />
            <el-option label="一般 MAJOR" value="MAJOR" />
            <el-option label="轻微 MINOR" value="MINOR" />
          </el-select>
        </el-form-item>
        <el-form-item label="优先级">
          <el-select v-model="form.priority" placeholder="可选，默认 P1" clearable style="width: 200px">
            <el-option label="P0" value="P0" />
            <el-option label="P1" value="P1" />
            <el-option label="P2" value="P2" />
          </el-select>
        </el-form-item>
        <el-form-item label="模块" prop="module">
          <el-input v-model="form.module" placeholder="如：登录模块" />
        </el-form-item>
        <el-form-item label="环境" prop="environment">
          <el-input v-model="form.environment" placeholder="如：Chrome 120 / Windows 11" />
        </el-form-item>
      </el-card>

      <el-card shadow="never" class="form-group">
        <template #header>复现信息</template>
        <el-form-item label="复现步骤" prop="steps">
          <el-input v-model="form.steps" type="textarea" :rows="4" placeholder="逐步描述复现操作" />
        </el-form-item>
        <el-form-item label="期望结果" prop="expected">
          <el-input v-model="form.expected" type="textarea" :rows="2" />
        </el-form-item>
        <el-form-item label="实际结果" prop="actual">
          <el-input v-model="form.actual" type="textarea" :rows="2" />
        </el-form-item>
      </el-card>

      <el-card shadow="never" class="form-group">
        <template #header>截图</template>
        <el-form-item label="复现截图">
          <el-upload
            drag
            multiple
            action=""
            :http-request="doUpload"
            accept=".png,.jpg,.jpeg"
            :show-file-list="false"
            :disabled="!form.projectId"
            class="shot-uploader"
          >
            <div class="el-upload__text">
              拖拽截图到此处，或点击上传<br />
              <span class="hint-inline">png / jpg / jpeg，单个 ≤5MB，可多选</span>
            </div>
            <div v-if="!form.projectId" class="hint">请先选择所属项目</div>
          </el-upload>
          <div v-if="uploaded.length" class="thumbs">
            <div v-for="att in uploaded" :key="att.id" class="thumb-item">
              <el-image :src="att.url" fit="cover" :preview-src-list="uploaded.map((a) => a.url)" preview-teleported class="thumb" />
              <el-button type="danger" link size="small" @click="removeShot(att)">删除</el-button>
            </div>
          </div>
        </el-form-item>
      </el-card>

      <div class="submit-bar">
        <el-button size="large" @click="goBack">取消</el-button>
        <el-button type="primary" size="large" :loading="submitting" @click="submit">提 交</el-button>
      </div>
    </el-form>
  </div>
</template>

<script setup lang="ts">
// T3-5 · Bug 提单表单：三组字段 + 截图即传即入库 + 关联用例（选后带出需求）
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, type FormInstance, type FormRules, type UploadRequestOptions } from 'element-plus';
import { createBug } from '../../api/bug';
import { listProjects, type Project } from '../../api/project';
import { listRequirements, type Requirement } from '../../api/requirement';
import { listCases, type TestCase } from '../../api/test-case';
import { uploadAttachment, type Attachment } from '../../api/attachment';

const router = useRouter();

const projects = ref<Project[]>([]);
const requirements = ref<Requirement[]>([]);
const cases = ref<TestCase[]>([]);
const uploaded = ref<Attachment[]>([]);
const submitting = ref(false);

const formRef = ref<FormInstance>();
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
const rules: FormRules = {
  projectId: [{ required: true, message: '请选择所属项目', trigger: 'change' }],
  title: [{ required: true, message: '请输入标题', trigger: 'blur' }],
  severity: [{ required: true, message: '请选择严重度', trigger: 'change' }],
  module: [{ required: true, message: '请输入模块', trigger: 'blur' }],
  environment: [{ required: true, message: '请输入环境', trigger: 'blur' }],
  steps: [{ required: true, message: '请输入复现步骤', trigger: 'blur' }],
  expected: [{ required: true, message: '请输入期望结果', trigger: 'blur' }],
  actual: [{ required: true, message: '请输入实际结果', trigger: 'blur' }],
};

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

/** 即传即入库：成功 push 缩略图；失败提示但不阻塞表单（AC 第 3 条） */
async function doUpload(options: UploadRequestOptions) {
  if (!form.projectId) {
    ElMessage.warning('请先选择所属项目');
    return;
  }
  try {
    const att = await uploadAttachment(options.file as File, { projectId: form.projectId, targetType: 'bug' });
    uploaded.value.push(att);
  } catch {
    // 拦截器已提示（类型/超限 400 等），此处不阻塞提交
  }
}

/** MVP 简化：删除 = 前端隐藏 + 提交时忽略（不调后端 DELETE） */
function removeShot(att: Attachment) {
  uploaded.value = uploaded.value.filter((item) => item.id !== att.id);
}

async function submit() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) {
    ElMessage.warning('请补全必填项');
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
    ElMessage.success(`提单成功：${bug.code}`);
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
.bug-form { max-width: 760px; }
.form-group { margin-bottom: 16px; }
.form-group :deep(.el-card__header) {
  font-weight: 600;
  font-size: 14px;
  color: var(--bt-text-title);
  padding: 12px 20px;
}
.form-group :deep(.el-card__body) { padding: 20px 20px 4px; }

.submit-bar {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding-top: 4px;
}

.hint { margin-left: 8px; color: var(--bt-text-muted); font-size: 12px; }
.hint-inline { color: var(--bt-text-muted); font-size: 12px; }

.shot-uploader { width: 420px; }
.shot-uploader :deep(.el-upload-dragger) {
  border-radius: var(--bt-radius-md);
  transition: border-color 0.2s ease, background 0.2s ease;
}
.shot-uploader :deep(.el-upload-dragger:hover) {
  border-color: var(--bt-primary);
  background: var(--bt-primary-bg);
}

.thumbs { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 8px; }
.thumb-item { text-align: center; }
.thumb {
  width: 120px;
  height: 90px;
  border-radius: var(--bt-radius-sm);
  border: 1px solid var(--bt-border);
  display: block;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.thumb:hover {
  transform: translateY(-2px);
  box-shadow: var(--bt-shadow-card-hover);
}
</style>
