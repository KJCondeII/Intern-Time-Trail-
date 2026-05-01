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
        start_url: '.',
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
        // This caches all your JS, CSS, and HTML for offline use
        globPatterns: ['**/*.{js,css,html,ico,png,svg}']
      }
    })
  ]
})