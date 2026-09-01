import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// T0-6 · Vite 配置：dev 代理转发 /api 到后端 3000
export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      // T3-5 · 附件缩略图直出：后端静态目录 /uploads/*（免鉴权）
      '/uploads': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
