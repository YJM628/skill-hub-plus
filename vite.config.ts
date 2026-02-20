import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@/chat-panel-core': path.resolve(__dirname, 'src/chat-panel-core'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api/chat': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      },
    },
  },
})
