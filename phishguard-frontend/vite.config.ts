import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from "path"

const DJANGO_ORIGIN = process.env.VITE_DJANGO_ORIGIN || 'http://127.0.0.1:8000';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5174,
    strictPort: true,
    open: true,
    proxy: {
      '/api': {
        target: DJANGO_ORIGIN,
        changeOrigin: true,
      },
    },
  },
})
