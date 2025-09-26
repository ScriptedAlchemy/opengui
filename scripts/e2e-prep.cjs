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

// Best-effort: initialize a real git repo with a feature worktree for multi-worktree E2E
function exec(cmd, args, cwd) {
  const { execFileSync } = require('node:child_process');
  try {
    execFileSync(cmd, args, { cwd, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function ensureGitRepoWithWorktree(rootDir) {
  const path = require('node:path');
  const fs = require('node:fs');
  const gitDir = path.join(rootDir, '.git');
  const worktreesDir = path.join(rootDir, 'worktrees');
  const featureDir = path.join(worktreesDir, 'feature');

  // If git is not available, skip silently
  if (!exec('git', ['--version'], rootDir)) return;

  // Initialize repo if needed
  if (!fs.existsSync(gitDir)) {
    exec('git', ['init'], rootDir);
    exec('git', ['config', 'user.email', 'demo@example.com'], rootDir);
    exec('git', ['config', 'user.name', 'Demo User'], rootDir);
    // Seed content and commit
    try { fs.writeFileSync(path.join(rootDir, '.gitignore'), 'node_modules\n', 'utf8'); } catch {}
    exec('git', ['add', '-A'], rootDir);
    // Commit; ignore failure if nothing to commit
    exec('git', ['commit', '-m', 'init'], rootDir);
    exec('git', ['branch', '-M', 'main'], rootDir);
  }

  // Ensure at least one commit exists to allow worktree creation
  if (!exec('git', ['rev-parse', '--verify', 'HEAD'], rootDir)) {
    exec('git', ['add', '-A'], rootDir);
    exec('git', ['commit', '-m', 'seed'], rootDir);
  }

  // Create feature worktree if missing
  try { fs.mkdirSync(worktreesDir, { recursive: true }); } catch {}
  const hasFeatureDir = fs.existsSync(featureDir);
  // Check if git already tracks feature worktree
  const listed = (() => {
    try {
      const { execFileSync } = require('node:child_process');
      const out = execFileSync('git', ['worktree', 'list', '--porcelain'], { cwd: rootDir }).toString();
      return out.includes('worktrees/feature');
    } catch {
      return false;
    }
  })();

  if (!hasFeatureDir || !listed) {
    // Use -B to create or reset the branch to current HEAD
    exec('git', ['worktree', 'add', '-B', 'feature', 'worktrees/feature'], rootDir);
  }
}

ensureGitRepoWithWorktree(DEMO_ROOT);

console.log('[e2e-prep] ensured demo project folders exist');
