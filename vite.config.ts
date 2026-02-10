import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { execSync } from 'child_process'
import pkg from './package.json'

const gitHash = execSync('git rev-parse --short HEAD').toString().trim()

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __GIT_HASH__: JSON.stringify(gitHash),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'https://jellyfish-app-xml6o.ondigitalocean.app',
        changeOrigin: true,
      },
    },
  },
})
