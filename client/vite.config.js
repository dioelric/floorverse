import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // Auto-update the service worker in the background; reload on next visit
      registerType: 'autoUpdate',

      // Assets to precache (static shell)
      includeAssets: ['favicon.svg', 'icons/icon-192.svg', 'icons/icon-512.svg'],

      // Web App Manifest
      manifest: {
        name: 'FloorVerse',
        short_name: 'FloorVerse',
        description: 'Experience Spaces Before You Visit — 3D floor plan & property visualization',
        theme_color: '#1A3C6B',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        scope: '/',
        id: 'floorverse-app',
        icons: [
          {
            src: 'icons/icon-192.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: 'icons/icon-512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
        screenshots: [],
        categories: ['productivity', 'business'],
      },

      // Workbox service worker options
      workbox: {
        // Precache all built JS, CSS, HTML, SVG, font files
        globPatterns: ['**/*.{js,css,html,svg,woff,woff2}'],

        // Never cache API calls — always go to network
        // Navigate fallback serves index.html for all client-side routes
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [
          /^\/api\//,
          /^\/uploads\//,
        ],

        runtimeCaching: [
          // Google Fonts stylesheets — stale-while-revalidate (fast + fresh)
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts-stylesheets',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Google Fonts files — cache-first (immutable)
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-files',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // API — always network; never serve stale floor plan data
          {
            urlPattern: /^.*\/api\/.*/i,
            handler: 'NetworkOnly',
          },
          // Uploaded files (images) — cache-first with 30-day expiry
          {
            urlPattern: /^.*\/uploads\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'uploads-cache',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },

      // Dev options: enable SW in dev so you can test install prompt
      devOptions: {
        enabled: false, // flip to true to test service worker locally
        type: 'module',
      },
    }),
  ],

  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:5001',
        changeOrigin: true,
      },
    },
  },
});
