import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    // د چاپیریال متغیرونه (Env Variables) راوړل
    const env = loadEnv(mode, process.cwd(), '');

    return {
      // 🟢 تر ټولو مهم بدلون: د الکټرون لپاره 'base' باید './' وي
      // دا د سپینې صفحې (White Screen) مخه نیسي
      base: './',

      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        // ستاسې د API کیلي ګانو تنظیمات (پر خپل ځای پاتې دي)
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      // د جوړولو (Build) لپاره ډاډمن تنظیمات
      build: {
        outDir: 'dist',
        emptyOutDir: true,
      }
    };
});
