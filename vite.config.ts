import { defineConfig } from 'vite-plus';
import { peerServerPlugin } from './peer-server-plugin.js';

export default defineConfig({
  root: '.',
  base: '/Uniball/',
  build: {
    outDir: 'dist',
  },
  plugins: [peerServerPlugin()],
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
