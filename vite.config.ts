/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/workout/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'icon-192.png',
        'icon-512.png',
        'favicon.svg',
        'favicon-32.png',
        'apple-touch-icon.png',
      ],
      // Fonts are self-hosted and precached so the gym's dead cell signal
      // can't leave the app rendering in a fallback face.
      workbox: { globPatterns: ['**/*.{js,css,html,png,svg,woff2}'] },
      manifest: {
        name: 'Workout Tracker',
        short_name: 'Workout',
        description: 'Offline workout tracker',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#111418',
        background_color: '#111418',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  test: {
    environment: 'node',
    setupFiles: ['src/test/setup.ts'],
  },
});
