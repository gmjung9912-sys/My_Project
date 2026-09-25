import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // 상대 경로로 빌드해 dist/index.html을 서버 없이 파일로 직접 열 수 있게 한다.
  base: './',
})
