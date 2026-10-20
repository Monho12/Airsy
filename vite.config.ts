import { fileURLToPath, URL } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    // Тестийн орчныг тестийн төрлөөр салгана (D41). Domain тест DOM болон UI setup-ийг хэзээ ч ачаалахгүй.
    projects: [
      {
        extends: true,
        test: {
          name: 'domain',
          // domain/** ба src/test/domain/**-ийн бүх тест энд — өргөтгөлөөс үл хамааран node орчинд (D41).
          include: ['src/domain/**/*.test.{ts,tsx}', 'src/test/domain/**/*.test.{ts,tsx}'],
          environment: 'node',
        },
      },
      {
        extends: true,
        test: {
          name: 'ui',
          include: ['src/**/*.test.{ts,tsx}'],
          // domain project-ийн include-тэй яг ижил — тест хоёр project-д давхар орохгүй, аль нэгээс нь алдахгүй.
          exclude: ['src/domain/**', 'src/test/domain/**'],
          environment: 'jsdom',
          setupFiles: ['./src/test/ui/setup.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'tooling',
          include: ['tooling/**/*.test.ts'],
          exclude: ['tooling/fixtures/**'],
          environment: 'node',
        },
      },
    ],
  },
});
