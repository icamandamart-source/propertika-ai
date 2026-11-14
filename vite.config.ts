import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const rootDir = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': rootDir,
    },
  },
  server: {
    allowedHosts: ['.trycloudflare.com'],
    // HMR dimatikan lewat env DISABLE_HMR agar tidak berkedip saat agen mengedit berkas.
    hmr: process.env.DISABLE_HMR !== 'true',
    watch: process.env.DISABLE_HMR === 'true' ? null : {},
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              // React dan router dimuat di semua halaman; pisahkan agar cache stabil.
              name: 'react',
              test: /[\\/]node_modules[\\/](react|react-dom|scheduler|react-router|react-router-dom)[\\/]/,
              priority: 30,
            },
            {
              // Firebase dimuat dinamis; pecah per paket supaya tidak ada chunk raksasa.
              name: 'firebase-auth',
              test: /[\\/]node_modules[\\/]@firebase[\\/]auth[\\/]/,
              priority: 20,
            },
            {
              name: 'firebase-firestore',
              test: /[\\/]node_modules[\\/]@firebase[\\/](firestore|webchannel-wrapper)[\\/]/,
              priority: 20,
              maxSize: 400_000,
            },
            {
              name: 'firebase-core',
              test: /[\\/]node_modules[\\/](firebase|@firebase)[\\/]/,
              priority: 10,
            },
            {
              name: 'icons',
              test: /[\\/]node_modules[\\/]lucide-react[\\/]/,
              priority: 5,
            },
          ],
        },
      },
    },
  },
});