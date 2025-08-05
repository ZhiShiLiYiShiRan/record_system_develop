import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5174,
    proxy: {
      // 转发所有 /api 请求到后端
      '/api': {
        target: 'http://192.168.0.228:5200',
        changeOrigin: true,
      },
      // 转发所有 /images 请求到后端静态目录
      '/images': {
        target: 'http://192.168.0.228:5200',
        changeOrigin: true,
      },
    },
    // HMR 配置（可保留也可删，默认也是 ws://localhost:5174）
    hmr: {
      protocol: 'ws',
      host: '192.168.0.228',
      port: 5174,
    },
  },
})