import { defineConfig } from '@rstest/core';
import { pluginReact } from '@rsbuild/plugin-react';

export default defineConfig({
  // Test environment - using jsdom for React component testing
  testEnvironment: 'jsdom',
  
  // Global test APIs (like Jest)
  globals: true,
  
  // Include both .test.ts and .test.tsx files from the test directory
  include: [
    'test/**/*.test.ts',
    'test/**/*.test.tsx'
  ],
  
  // Exclude patterns - exclude playwright e2e tests but keep unit tests
  exclude: [
    'test/e2e/**/*.e2e.ts',
    'node_modules/**/*',
    'dist/**/*',
    'build/**/*',

  ],
  
  // Setup files (none needed; E2E handles bootstrapping)
  
  // Test timeout
  testTimeout: 45000,
  maxConcurrency: 2,
  
  // Build configuration - inherit from rsbuild
  // Enable React support (JSX/TSX + React Refresh in dev)
  plugins: [pluginReact()],
  
  // Resolve configuration to handle imports
  resolve: {
    alias: {
      '@': './src',
      '@/components': './src/components',
      '@/hooks': './src/hooks',
      '@/lib': './src/lib',
      '@/pages': './src/pages',
      '@/services': './src/services',
      '@/stores': './src/stores',
      '@/types': './src/types',
      '@/util': './src/util'
    }
  },
  
  // Environment variables
  source: {
    define: {
      'process.env.NODE_ENV': '"test"'
    }
  }
});
