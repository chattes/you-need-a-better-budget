import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      $lib: '/src/lib'
    }
  },
  test: {
    include: ['src/test/**/*.test.ts'],
    environment: 'node',
    passWithNoTests: true
  }
});
