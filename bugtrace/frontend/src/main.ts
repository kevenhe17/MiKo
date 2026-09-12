// T0-6 · 前端骨架入口
// v0.2 · 引入 Ant Design Vue 4（CSS-in-JS，样式运行时注入）
//        样式顺序：antd reset → Element Plus → 本项目设计基建（后者优先级最高）
import { createApp } from 'vue';
import { createPinia } from 'pinia';

import 'ant-design-vue/dist/reset.css';
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';
import zhCn from 'element-plus/es/locale/lang/zh-cn';
import Antd from 'ant-design-vue';
import './styles/index.css';

import App from './App.vue';
import router from './router';

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.use(ElementPlus, { locale: zhCn });
// 迁移期：Ant Design Vue 与 Element Plus 并存，逐页替换后再移除 EP
app.use(Antd);
app.mount('#app');
