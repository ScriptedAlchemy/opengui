import { defineConfig } from '@rslib/core';
import { pluginTypeCheck } from '@rsbuild/plugin-type-check';

export default defineConfig({
  plugins: [
    pluginTypeCheck({
      enable: true,
      tsCheckerOptions: {
        typescript: {
          configFile: './tsconfig.server.json',
        },
      },
    }),
  ],
  lib: [
    {
      format: 'esm',
      syntax: 'es2022',
      // Bundle dependencies instead of externalizing, so @opencode-ai/sdk is included.
      autoExternal: false,
      output: {
        distPath: {
          root: './server-dist',
        },
        // Externalize native/optional modules used only at runtime.
        // See: https://rslib.rs/guide/advanced/third-party-deps and https://rslib.rs/config/lib/auto-external
        externals: ['node-pty', 'ws', 'bufferutil', 'utf-8-validate'],
      },
    },
  ],
  source: {
    entry: {
      index: './src/server/index.ts',
    },
  },
  output: {
    target: 'node',
    // Do not clean server-dist so client assets in server-dist/web-dist remain intact
    cleanDistPath: false,
  },
});
