import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react()
  ],
  server: {
    port: 8081,
    host: '0.0.0.0',
    proxy: {
      '/api/projects': {
        target: 'http://localhost:3000',
        changeOrigin: true
      },
      '/api/issues': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  }
})
