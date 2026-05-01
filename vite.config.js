import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',

      includeAssets: ['favicon.ico', 'logo192.png', 'logo512.png'],

      manifest: {
        name: 'OJT Attendance System',
        short_name: 'OJT System',
        description: 'Offline-capable OJT Attendance Tracker',
        theme_color: '#0f172a',
        background_color: '#f8fafc',
        display: 'standalone',
        start_url: '/', // ✅ FIXED
        icons: [
          {
            src: '/logo192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/logo512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },

      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],

        // ✅ REQUIRED for React apps
        navigateFallback: '/index.html',

        runtimeCaching: [
          {
            urlPattern: ({ request }) =>
              request.destination === 'document',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'pages-cache'
            }
          },
          {
            urlPattern: ({ request }) =>
              request.destination === 'image',
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache'
            }
          }
        ]
      }
    })
  ]
})
