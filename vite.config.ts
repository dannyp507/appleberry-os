import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
                return 'react-vendor';
              }
              if (id.includes('firebase')) {
                return 'firebase-vendor';
              }
              if (id.includes('jspdf') || id.includes('html2canvas') || id.includes('dompurify')) {
                return 'document-vendor';
              }
              if (id.includes('papaparse') || id.includes('xlsx')) {
                return 'import-vendor';
              }
              if (id.includes('recharts') || id.includes('d3-') || id.includes('victory')) {
                return 'charts-vendor';
              }
              if (id.includes('lucide-react')) {
                return 'icons-vendor';
              }
            }
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify - file watching is disabled to prevent flickering during agent edits.
      hmr: env.DISABLE_HMR !== 'true',
    },
  };
});
