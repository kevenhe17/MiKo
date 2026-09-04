<template>
  <div class="login-page">
    <!-- 背景：极浅蓝灰渐变 -->
    <div class="bg-gradient"></div>

    <div class="login-container">
      <!-- 左侧品牌展示区：编辑式排版 -->
      <div class="brand-section">
        <div class="brand-titles">
          <h1 class="brand-line">追踪每一个</h1>
          <div class="brand-accent-row">
            <h1 class="brand-line brand-accent">Bug</h1>
          </div>
        </div>
        <p class="brand-desc">
          智能缺陷追踪平台，帮助团队高效管理、追踪并解决每一个问题，让软件质量更上一层楼。
        </p>

        <div class="feature-cards">
          <div class="feature-card">
            <div class="feature-name">快速开始</div>
            <div class="feature-desc">一键创建项目，即刻开始缺陷追踪之旅</div>
          </div>
          <div class="feature-card">
            <div class="feature-name">API 集成</div>
            <div class="feature-desc">丰富的 REST API，轻松对接现有工作流</div>
          </div>
        </div>
      </div>

      <!-- 右侧登录表单：极简白卡 -->
      <div class="form-section">
        <div class="login-card">
          <!-- Logo -->
          <div class="logo-wrap">
            <img src="/icon.png" alt="BugTrace" class="logo-img" />
          </div>

          <h2 class="card-title">欢迎回来</h2>
          <p class="card-subtitle">登录您的账号，继续追踪工作</p>

          <el-form ref="formRef" :model="form" :rules="rules" label-position="top" hide-required-asterisk @submit.prevent>
            <el-form-item prop="username" label="用户名" class="form-item">
              <el-input
                v-model="form.username"
                placeholder="请输入用户名"
                :prefix-icon="User"
                size="large"
              />
            </el-form-item>
            <el-form-item prop="password" label="密码" class="form-item">
              <el-input
                v-model="form.password"
                type="password"
                show-password
                :prefix-icon="Lock"
                placeholder="请输入密码"
                size="large"
                @keyup.enter="onLogin"
              />
            </el-form-item>
            <el-button type="primary" class="submit-btn" :loading="loading" @click="onLogin" size="large">
              登录
            </el-button>
          </el-form>

          <p class="hint">演示账号：admin / dev / qa，密码 admin123 / dev123 / qa123</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, type FormInstance, type FormRules } from 'element-plus';
import { User, Lock } from '@element-plus/icons-vue';
import { login } from '../../api/auth';
import { useUserStore } from '../../stores/user';

const router = useRouter();
const userStore = useUserStore();
const formRef = ref<FormInstance>();
const loading = ref(false);

const form = reactive({ username: '', password: '' });
const rules: FormRules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
};

async function onLogin() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;

  loading.value = true;
  try {
    const result = await login(form);
    userStore.setLogin(result.token, result.user);
    ElMessage.success(`欢迎，${result.user.realname}`);
    router.push('/dashboard');
  } catch {
    // 拦截器统一提示
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
/* ============================================
   登录页 — 极简编辑式设计
   核心：大字体张力 + 超轻输入框 + 大量留白
   ============================================ */

.login-page {
  position: relative;
  height: 100%;
  overflow: hidden;
}

/* —— 背景：近白底 + 淡蓝径向光晕 —— */
.bg-gradient {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(1100px 620px at 16% 8%, rgba(125, 180, 250, 0.26), transparent 60%),
    radial-gradient(900px 560px at 80% 90%, rgba(147, 197, 253, 0.3), transparent 62%),
    linear-gradient(150deg, #f7fafd 0%, #eff4fa 55%, #e9f0f8 100%);
}

.login-container {
  position: relative;
  z-index: 1;
  display: flex;
  width: 100%;
  height: 100%;
  max-width: 1200px;
  margin: 0 auto;
}

/* —— 左侧品牌区：杂志编辑式排版 —— */
.brand-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 48px 64px;
  min-width: 0;
}

.brand-titles {
  margin-bottom: 28px;
}

.brand-line {
  font-family: var(--bt-font-display);
  font-size: clamp(3rem, 5.5vw, 4.5rem);
  font-weight: 700;
  color: #111827;
  margin: 0;
  line-height: 1.1;
  letter-spacing: -0.04em;
}

.brand-accent-row {
  position: relative;
  display: inline-block;
}

/* "Bug"：衬线斜体 + 黄色荧光笔高亮 */
.brand-accent {
  color: #111827;
  position: relative;
  z-index: 0;
  font-style: italic;
  padding: 0 0.06em;
}

.brand-accent::after {
  content: '';
  position: absolute;
  left: -2%;
  right: -2%;
  bottom: 0.06em;
  height: 0.34em;
  background: #fce68b;
  border-radius: 3px;
  z-index: -1;
}

.brand-desc {
  font-family: var(--bt-font-body);
  font-size: 1rem;
  font-weight: 400;
  color: #6b7280;
  line-height: 1.8;
  max-width: 400px;
  margin: 0 0 48px;
}

/* —— 功能卡片：两列白色实体卡 —— */
.feature-cards {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  max-width: 460px;
}

.feature-card {
  padding: 16px 18px;
  border-radius: 12px;
  border: 1px solid #eef2f7;
  background: #ffffff;
  box-shadow: 0 2px 10px rgba(15, 23, 42, 0.05);
  transition: box-shadow 0.2s ease, transform 0.2s ease;
}

.feature-card:hover {
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.08);
  transform: translateY(-1px);
}

.feature-name {
  font-family: var(--bt-font-body);
  font-size: 0.9rem;
  font-weight: 600;
  color: #3B8CFF;
  margin-bottom: 3px;
}

.feature-desc {
  font-family: var(--bt-font-body);
  font-size: 0.8rem;
  font-weight: 400;
  color: #9ca3af;
  line-height: 1.5;
}

/* —— 右侧表单区 —— */
.form-section {
  flex: 0 0 420px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 32px;
}

.login-card {
  width: 100%;
  max-width: 360px;
  padding: 44px 40px 36px;
  background: #ffffff;
  border-radius: 16px;
  border: 1px solid #eef2f8;
  box-shadow: 0 12px 40px rgba(30, 58, 95, 0.1);
}

.logo-wrap {
  margin-bottom: 20px;
}

.logo-img {
  width: 64px;
  height: 64px;
  border-radius: 16px;
  display: block;
  box-shadow:
    0 0 0 5px rgba(91, 156, 245, 0.15),
    0 10px 24px rgba(59, 125, 224, 0.28);
  object-fit: cover;
}

.card-title {
  font-family: var(--bt-font-display);
  font-size: 1.5rem;
  font-weight: 600;
  color: #4a5568;
  margin: 0 0 4px;
}

.card-subtitle {
  font-family: var(--bt-font-body);
  font-size: 0.85rem;
  font-weight: 400;
  color: #9ca3af;
  margin: 0 0 32px;
}

/* —— 表单 label（用户名 / 密码） —— */
:deep(.el-form-item__label) {
  font-family: var(--bt-font-body);
  font-size: 0.82rem;
  font-weight: 500;
  color: #4a5568;
  line-height: 1.4 !important;
  margin-bottom: 4px !important;
  padding: 0 !important;
}

/* —— 输入框：白底 + 1px 浅灰边框 + focus 蓝色光环 —— */
.form-item {
  margin-bottom: 20px;
}

:deep(.el-input__wrapper) {
  border-radius: 8px !important;
  box-shadow: 0 0 0 1px #e2e8f0 inset !important;
  padding: 4px 14px !important;
  background: #ffffff !important;
  transition: all 0.15s ease !important;
}

:deep(.el-input__wrapper:hover) {
  box-shadow: 0 0 0 1px #cbd5e1 inset !important;
  background: #fff !important;
}

:deep(.el-input__wrapper.is-focus) {
  box-shadow:
    0 0 0 1px #3b82f6 inset,
    0 0 0 3px rgba(59, 130, 246, 0.15) !important;
  background: #fff !important;
}

:deep(.el-input__inner) {
  font-family: var(--bt-font-body);
  font-size: 0.95rem;
  color: #111827;
}

:deep(.el-input__inner::placeholder) {
  color: #c4c9d4;
}

:deep(.el-input__prefix-inner) {
  color: #c4c9d4;
}

/* —— 登录按钮：去饱和深钢蓝 —— */
.submit-btn {
  width: 100%;
  height: 46px;
  margin-top: 4px;
  border: none;
  border-radius: 8px;
  background: #34689f;
  font-family: var(--bt-font-body);
  font-size: 1rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  transition: all 0.2s ease;
}

.submit-btn:hover,
.submit-btn:focus {
  background: #2c5a8a;
  box-shadow: 0 6px 18px rgba(52, 104, 159, 0.3);
}

.submit-btn:active {
  background: #274f79;
}

/* —— 分隔线 + 演示账号提示 —— */
.hint {
  margin: 24px 0 0;
  padding-top: 18px;
  border-top: 1px solid #eef1f6;
  font-family: var(--bt-font-body);
  font-size: 0.78rem;
  color: #9aa3b2;
  text-align: center;
}

/* —— 响应式 —— */
@media (max-width: 1023px) {
  .brand-section {
    padding: 32px 40px;
  }
  .brand-line {
    font-size: 2.5rem;
  }
  .brand-desc {
    font-size: 0.9rem;
    margin-bottom: 32px;
  }
  .feature-cards {
    max-width: 100%;
  }
}

@media (max-width: 767px) {
  .login-container {
    flex-direction: column;
  }
  .brand-section {
    flex: none;
    padding: 36px 24px 16px;
  }
  .brand-line {
    font-size: 2rem;
  }
  .brand-desc {
    display: none;
  }
  .feature-cards {
    display: none;
  }
  .form-section {
    flex: none;
    padding: 16px;
  }
  .login-card {
    padding: 32px 24px 28px;
  }
}
</style>
