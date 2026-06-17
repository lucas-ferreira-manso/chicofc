import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'
import { readFileSync } from 'fs'
import { execSync } from 'child_process'

const { version } = JSON.parse(readFileSync('./package.json', 'utf-8'))
const [major, minor] = version.split('.')
let commitCount = '0'
try { commitCount = execSync('git rev-list --count HEAD').toString().trim() } catch {}
const autoVersion = `${major}.${minor}.${commitCount}`

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(autoVersion),
  },
  resolve: {
    alias: {
      '@phosphor-icons/react': path.resolve('./node_modules/@phosphor-icons/react/dist/index.cjs.js')
    }
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'Chico FC',
        short_name: 'ChicoFC',
        description: 'App da pelada do Chico',
        theme_color: '#082996',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      },
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.firebaseio\.com\/.*/i,
            handler: 'NetworkFirst',
            options: { cacheName: 'firebase-cache', expiration: { maxEntries: 50, maxAgeSeconds: 300 } }
          }
        ]
      }
    })
  ]
})