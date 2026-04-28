import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, (process as any).cwd(), '');

  return {
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY || ''),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || ''),
      'process.env.NEXT_PUBLIC_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || ''),
      'process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''),
    },
    resolve: {
      alias: {
        '@': path.resolve(path.dirname(fileURLToPath(import.meta.url)), './'),
      },
      extensions: ['.js', '.ts', '.jsx', '.tsx', '.json']
    },
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      emptyOutDir: true,
      rollupOptions: {
        output: {
          assetFileNames: "assets/[name]-[hash]-[hash][extname]",
          chunkFileNames: "assets/[name]-[hash]-[hash].js",
          entryFileNames: "assets/[name]-[hash]-[hash].js",
          manualChunks: (id) => {
            if (id.includes('node_modules')) {
              if (id.includes('pdfjs-dist')) return 'vendor-pdfjs-v2';
              if (id.includes('jspdf') || id.includes('html2canvas')) return 'vendor-pdf-tools-v2';
              if (id.includes('xlsx')) return 'vendor-xlsx-v2';
              if (id.includes('recharts') || id.includes('d3')) return 'vendor-recharts-v2';
              if (id.includes('supabase')) return 'vendor-db-v2';
              if (id.includes('@google/genai')) return 'vendor-ai-v2';
              return 'vendor-v2';
            }
          }
        }
      }
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      allowedHosts: true,
      cors: true
    }
  };
});