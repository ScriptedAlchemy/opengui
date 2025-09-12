import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';
import { pluginTypeCheck } from '@rsbuild/plugin-type-check';

export default defineConfig({
  plugins: [
    pluginReact(),
    pluginTypeCheck({
      enable: true,
    }),
  ],
  source: {
    entry: {
      index: './src/main.tsx',
    },
  },
  html: {
    template: './index.html',
  },
  output: {
    // Emit client assets directly into server-dist/web-dist so the server can serve them
    distPath: {
      root: 'server-dist/web-dist',
    },
    cleanDistPath: true,
    // Disable minification for debugging purposes
    minify: false,
  },
  server: {
    port: 5173,
  },
  dev: {
    hmr: true,
  },
  tools: {
    rspack: {
      resolve: {
        // Prefer JS entries in package exports to avoid TS sources in node_modules
        conditionNames: ["import", "module", "browser", "default"],
        fallback: {
          "fs": false,
          "path": false,
          "os": false,
          "crypto": false,
          "http": false,
          "https": false,
          "url": false,
          "util": false,
          "stream": false,
          "events": false,
          "buffer": false,
          "process": false,
          "child_process": false,
          "net": false,
          "tls": false,
          "zlib": false,
        },
      },
    },
  },
  environments: {
    web: {
      source: {
        entry: {
          index: './src/main.tsx',
        },
      },
      output: {
        target: 'web',
      },
    },
  },
});
