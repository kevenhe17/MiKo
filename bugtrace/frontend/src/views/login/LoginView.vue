<template>
  <div class="login-page">
    <!-- 氛围装饰：渐变光斑 + 点阵 -->
    <div class="blob blob-a"></div>
    <div class="blob blob-b"></div>
    <div class="dots"></div>

    <el-card class="login-card">
      <div class="brand">
        <div class="logo-mark">B</div>
      </div>
      <h2 class="title">BugTrace</h2>
      <p class="subtitle">缺陷跟踪 · 让每个 Bug 都有迹可循</p>
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top" @submit.prevent>
        <el-form-item label="用户名" prop="username">
          <el-input v-model="form.username" placeholder="admin / dev / qa" :prefix-icon="User" />
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input
            v-model="form.password"
            type="password"
            show-password
            :prefix-icon="Lock"
            @keyup.enter="onLogin"
          />
        </el-form-item>
        <el-button type="primary" class="login-btn" :loading="loading" @click="onLogin">
          登 录
        </el-button>
      </el-form>
      <p class="tip">演示账号：admin / dev / qa，密码 123456</p>
    </el-card>
  </div>
</template>

<script setup lang="ts">
// T1-4 · 真实登录对接：成功存 token+user 并跳 /projects；失败给可读提示
// U2 · 活泼产品风视觉：品牌渐变氛围 + 玻璃质感卡片（仅样式，不动登录逻辑）
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
    router.push('/projects');
  } catch {
    // 错误提示已由拦截器统一弹出（账号或密码错误）
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.login-page {
  position: relative;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #a855f7 100%);
}

/* —— 氛围光斑 —— */
.blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(70px);
  opacity: 0.5;
  pointer-events: none;
}
.blob-a {
  width: 420px;
  height: 420px;
  top: -120px;
  left: -100px;
  background: #818cf8;
}
.blob-b {
  width: 380px;
  height: 380px;
  bottom: -140px;
  right: -80px;
  background: #d946ef;
}

/* —— 点阵纹理 —— */
.dots {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image: radial-gradient(rgba(255, 255, 255, 0.16) 1px, transparent 1px);
  background-size: 22px 22px;
}

/* —— 卡片 —— */
.login-card {
  position: relative;
  z-index: 1;
  width: 400px;
  padding: 8px 4px 4px;
  text-align: center;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 24px 64px rgba(31, 41, 55, 0.28);
}
.brand { margin-top: 6px; }
.logo-mark {
  width: 52px;
  height: 52px;
  margin: 0 auto;
  border-radius: 16px;
  background: var(--bt-gradient);
  color: #fff;
  font-size: 28px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 20px rgba(99, 102, 241, 0.4);
}
.title {
  margin: 12px 0 2px;
  color: var(--bt-text-title);
  letter-spacing: 0.5px;
}
.subtitle {
  margin: 0 0 20px;
  color: var(--bt-text-muted);
  font-size: 13px;
}

/* —— 渐变登录按钮 —— */
.login-btn {
  width: 100%;
  height: 42px;
  margin-top: 4px;
  border: none;
  border-radius: var(--bt-radius-sm);
  background: var(--bt-gradient);
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 4px;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.login-btn:hover,
.login-btn:focus {
  background: var(--bt-gradient);
  transform: translateY(-1px);
  box-shadow: 0 8px 20px rgba(99, 102, 241, 0.45);
}
.login-btn:active {
  background: var(--bt-gradient);
  transform: translateY(0);
}

.tip {
  margin: 16px 0 4px;
  font-size: 12px;
  color: var(--bt-text-muted);
}
</style>
