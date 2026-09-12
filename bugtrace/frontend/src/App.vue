<template>
  <!-- v0.2 · Ant Design Vue 主题与语言上下文（a-app 提供 message/modal 的 useApp 上下文） -->
  <a-config-provider :theme="antdTheme" :locale="zhCN">
    <a-app>
      <router-view />
    </a-app>
  </a-config-provider>
</template>

<script setup lang="ts">
import zhCN from 'ant-design-vue/es/locale/zh_CN';
import 'dayjs/locale/zh-cn';
import { antdTheme } from './styles/antd-theme';
</script>

<style>
html, body, #app {
  height: 100%;
  margin: 0;
  padding: 0;
}

/* ConfigProvider 会插入 .ant-app 包裹层，必须透传高度，
   否则依赖 height:100% 的登录页与主布局会塌陷 */
.ant-app {
  height: 100%;
}
</style>
