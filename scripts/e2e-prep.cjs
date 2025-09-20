#!/usr/bin/env node
// Pre-start script for E2E: create demo project folders so the server
// does not warn about missing project paths on boot.
const fs = require('node:fs');
const path = require('node:path');

const CWD = process.cwd();
const RESULTS_DIR = path.join(CWD, 'test-results');
const DEMO_ROOT = path.join(RESULTS_DIR, 'e2e-demo-project');
const CRYSTAL_ROOT = path.join(RESULTS_DIR, 'e2e-crystal-project');

function ensureProjectOnDisk(rootDir, name) {
  const srcDir = path.join(rootDir, 'src');
  const componentsDir = path.join(srcDir, 'components');
  fs.mkdirSync(componentsDir, { recursive: true });

  const pkgPath = path.join(rootDir, 'package.json');
  const readmePath = path.join(rootDir, 'README.md');
  const indexPath = path.join(srcDir, 'index.ts');
  const componentPath = path.join(componentsDir, 'App.tsx');

  const pkg = {
    name,
    version: '1.0.0',
    main: 'src/index.ts',
    scripts: { build: "echo 'build'", test: "echo 'test'" },
  };
  try { fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8'); } catch {}
  try { fs.writeFileSync(readmePath, `# ${name}\n\nGenerated for E2E.\n`, 'utf8'); } catch {}
  try { fs.writeFileSync(indexPath, "export const run = () => 'ok'\n", 'utf8'); } catch {}
  try { fs.writeFileSync(componentPath, "export const App = () => 'Hello';\n", 'utf8'); } catch {}
}

try { fs.mkdirSync(RESULTS_DIR, { recursive: true }); } catch {}
ensureProjectOnDisk(DEMO_ROOT, 'e2e-demo-project');
ensureProjectOnDisk(CRYSTAL_ROOT, 'e2e-crystal-project');

console.log('[e2e-prep] ensured demo project folders exist');

