// Cloud helpers (GitHub Actions runner). The studio keeps its state in a PRIVATE git repo (DATA_REPO_DIR); every change is committed and pushed so that the next run
// (and your laptop, if you ever pull it) sees it. Used by server.mjs in TICK mode only.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const dir = () => process.env.DATA_REPO_DIR || '';
const git = (...args) => spawnSync('git', ['-c', 'user.name=bot', '-c', 'user.email=bot@users.noreply.github.com', ...args], { cwd: dir(), encoding: 'utf8' });

export function persist(message = 'studio state') {
  if (!dir()) return { skipped: true };
  git('add', '-A');
  if (git('status', '--porcelain').stdout.trim() === '') return { changed: false };
  const c = git('commit', '-q', '-m', message);
  if (c.status !== 0) return { error: (c.stderr || c.stdout).slice(0, 200) };
  for (let i = 0; i < 3; i++) {
    git('pull', '--rebase', '--autostash', '-q');
    const p = git('push', '-q');
    if (p.status === 0) return { changed: true };
  }
  return { error: 'push failed' };
}

// Keeps the data repo small: once a post is well past its publish time (or was rejected) its heavy files are deleted. Only the cover (slide_01.jpg, used by the
// results chart) and the small text files stay. Posts that are still waiting for approval or a slot are never touched.
export function pruneImages(state, postsRoot) {
  const now = Date.now(); let files = 0, bytes = 0;
  for (const p of state.posts) {
    const dir = path.join(postsRoot, String(p.dir || '').split(/[\\/]/).pop());
    if (!p.dir || !fs.existsSync(dir)) continue;
    const dues = (p.buffer || []).map((e) => new Date(e.dueAt).getTime()).filter(Boolean);
    const published = dues.length > 0 && Math.max(...dues) < now - 3 * 864e5;
    const rejected = p.status === 'rejected' && p.createdAt && new Date(p.createdAt).getTime() < now - 2 * 864e5;
    if (!published && !rejected) continue;
    for (const f of fs.readdirSync(dir)) {
      if (/^(slide_(0[2-9]|[1-9]\d)\.jpg|img_\d+\.jpg|pdf_preview\.png|.*\.pdf)$/.test(f)) { const fp = path.join(dir, f); bytes += fs.statSync(fp).size; fs.unlinkSync(fp); files++; }
    }
  }
  return { files, bytes };
}

// Monthly: replace the whole history by one snapshot commit so old images that were ever committed stop taking space (the repo is private and only holds working state).
export function squashHistory() {
  if (!dir()) return { skipped: true };
  const steps = [['checkout', '--orphan', 'snapshot'], ['add', '-A'], ['commit', '-q', '-m', 'snapshot'], ['branch', '-M', 'main'], ['push', '-f', '-q', 'origin', 'main']];
  for (const st of steps) { const r = git(...st); if (r.status !== 0) return { error: st[0] + ': ' + (r.stderr || '').slice(0, 160) }; }
  return { squashed: true };
}
