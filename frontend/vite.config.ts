import fs from 'fs'
import path from 'path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Vite plugin to duplicate index.html to 404.html for static hosts (Render, GitHub Pages, Netlify)
function generate404Plugin() {
  return {
    name: 'generate-404-fallback',
    closeBundle() {
      const distDir = path.resolve(__dirname, 'dist')
      const indexPath = path.join(distDir, 'index.html')
      const notFoundPath = path.join(distDir, '404.html')
      try {
        if (fs.existsSync(indexPath)) {
          fs.copyFileSync(indexPath, notFoundPath)
          console.log('[vite] Generated dist/404.html for SPA static hosting fallback')
        }
      } catch (e) {
        console.warn('[vite] Could not generate 404.html fallback:', e)
      }
    },
  }
}

export default defineConfig({
  plugins: [react(), generate404Plugin()],
  server: {
    port: 5173,
    proxy: {
      '/static': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
})
