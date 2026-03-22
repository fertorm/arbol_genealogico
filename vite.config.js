import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icon.svg', 'icon-192x192.png', 'icon-512x512.png', 'icon-maskable-512x512.png'],
      manifest: {
        name: 'My Family Tree',
        short_name: 'My Family Tree',
        description: 'Build, view and share your family tree — collaborative and real-time.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait-primary',
        background_color: '#F5F0E8',
        theme_color: '#C9A227',
        lang: 'es',
        icons: [
          {
            src: '/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icon-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        categories: ['utilities', 'lifestyle'],
        prefer_related_applications: false,
      },
      workbox: {
        // Cache the app shell and static assets
        // But don't cache Supabase API calls — we need live data
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2}'],
        runtimeCaching: [
          {
            // Cache Google Fonts
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
        // Don't cache Supabase API calls
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/rest\/v1\//, /^\/auth\/v1\//],
      },
      devOptions: {
        enabled: false, // keep SW disabled in dev to avoid confusion
      },
    }),
  ],
})
