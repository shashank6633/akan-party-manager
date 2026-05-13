import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'akan-logo.png',
        'apple-touch-icon.png',
        'favicon-16.png',
        'favicon-32.png',
        'akan-icon-192-maskable.png',
        'akan-icon-512-maskable.png',
      ],
      manifest: {
        name: 'AKAN Party Manager',
        short_name: 'AKAN',
        description: 'Manage catering events, F&P, billing, feedback, and party bookings.',
        theme_color: '#af4408',
        background_color: '#fff9eb',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          // "any" purpose — used wherever the OS doesn't apply a mask
          { src: '/akan-icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/akan-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          // "maskable" — logo sits inside a safe zone so Android adaptive
          // masks (circle/squircle/rounded square) don't crop the AKAN mark
          { src: '/akan-icon-192-maskable.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/akan-icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Cache static app assets but always fetch API calls fresh
        globPatterns: ['**/*.{js,css,html,png,jpg,jpeg,svg,woff2,ico}'],
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            // Google Fonts CSS — short cache so font updates pick up quickly
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts-stylesheets',
            },
          },
          {
            // Google Fonts woff2 files — long cache (immutable)
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Never cache /api/* — always go to the network
            urlPattern: /\/api\/.*/i,
            handler: 'NetworkOnly',
          },
        ],
        // Don't precache massive bundles, but allow up to 5 MB per file
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
      devOptions: {
        enabled: false, // disable PWA in dev to avoid HMR conflicts
      },
    }),
  ],
  server: {
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
