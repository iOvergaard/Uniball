import { defineConfig } from 'vite-plus';

export default defineConfig({
  root: '.',
  base: '/Uniball/',
  build: {
    outDir: 'dist',
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
  lint: {
    ignorePatterns: ['dist/**', 'node_modules/**'],
  },
  fmt: {
    semi: true,
    singleQuote: true,
  },
});
