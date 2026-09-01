// T0-6 · 路由表：/login + 布局路由（业务子路由占位页）
// T1-4 · 路由守卫：无 token 访问业务路由 → /login；已登录访问 /login → /projects
import { createRouter, createWebHistory } from 'vue-router';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/login/LoginView.vue'),
    },
    {
      path: '/',
      component: () => import('../layouts/MainLayout.vue'),
      redirect: '/projects',
      children: [
        { path: 'projects', name: 'projects', component: () => import('../views/project/ProjectListView.vue') },
        { path: 'requirements', name: 'requirements', component: () => import('../views/requirement/RequirementListView.vue') },
        { path: 'cases', name: 'cases', component: () => import('../views/test-case/CaseListView.vue') },
        { path: 'cases/:id', name: 'case-detail', component: () => import('../views/test-case/CaseDetailView.vue') },
        { path: 'plans', name: 'plans', component: () => import('../views/test-plan/PlanListView.vue') },
        { path: 'plans/:id', name: 'plan-detail', component: () => import('../views/test-plan/PlanDetailView.vue') },
        { path: 'bugs', name: 'bugs', component: () => import('../views/bug/BugListView.vue') },
        // T3-5 · 提单表单（静态段优先于动态段注册）
        { path: 'bugs/new', name: 'bug-create', component: () => import('../views/bug/BugCreateView.vue') },
        // T3-4 · 详情路由占位（T3-6 填充页面）
        { path: 'bugs/:id', name: 'bug-detail', component: () => import('../views/bug/BugDetailView.vue') },
        // T5-4 · 变更流转（主干/分支软件变更：报表 + 图表 + 状态机流转）
        { path: 'changes', name: 'changes', component: () => import('../views/change/ChangeListView.vue') },
      ],
    },
    { path: '/:pathMatch(.*)*', redirect: '/projects' },
  ],
});

// 路由守卫（T1-4）：以 localStorage 的 token 为准（刷新后由 store 恢复）
router.beforeEach((to) => {
  const token = localStorage.getItem('bugtrace_token');
  if (to.path === '/login') {
    return token ? '/projects' : true;
  }
  if (!token) {
    return '/login';
  }
  return true;
});

export default router;
