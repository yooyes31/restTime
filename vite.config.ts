import path from 'node:path'

import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// Issue #1: Vite + Vue + PWA 설정 (sql.js WASM은 별도 COOP/COEP 없이 동작)
export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        enabled: true,
      },
      manifest: {
        name: 'restTime',
        short_name: 'restTime',
        description: '식단·운동·인바디 기록 PWA',
        lang: 'ko-KR',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait-primary',
        theme_color: '#409EFF',
        background_color: '#ffffff',
        categories: ['health', 'lifestyle'],
        icons: [
          {
            src: 'icons/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icons/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icons/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,wasm,webmanifest}'],
        navigateFallback: 'index.html',
      },
      includeAssets: ['icons/**/*.png', '_redirects'],
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      // sql.js browser CJS 번들을 Vite 가 비어 있는 chunk 로 만들지 않도록 절대 경로 alias — 한글 주석
      'sqljs-wasm-browser': path.resolve(__dirname, 'node_modules/sql.js/dist/sql-wasm-browser.js'),
    },
  },
  optimizeDeps: {
    exclude: ['sql.js'],
  },
})
