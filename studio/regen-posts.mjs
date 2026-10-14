// Re-renders posts that are awaiting approval with the current renderer (photo judge + varied data designs). Run with the studio service STOPPED (it owns state.json).
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1'));
const state = JSON.parse(fs.readFileSync(path.join(here, 'data', 'state.json'), 'utf8'));
const only = process.argv.slice(2).map(Number);
for (const p of state.posts) {
  if (p.status !== 'awaiting_approval' || (only.length && !only.includes(p.no))) continue;
  console.log('#' + p.no, p.keyword, p.kind || 'story');
  if (p.kind === 'data') {
    const r = spawnSync(process.execPath, [path.join(here, 'data-post.mjs'), p.dataHs, p.dir], { encoding: 'utf8' });
    console.log(r.status === 0 ? '  rebuilt' : '  FAILED ' + r.stderr.slice(-200));
  } else {
    for (const f of fs.readdirSync(p.dir)) if (/^img_\d+\.jpg(\.credit\.json|\.nophoto)?$|^slide_\d+\.jpg$/.test(f)) fs.rmSync(path.join(p.dir, f));
    const r = spawnSync(process.execPath, [path.join(here, '..', 'renderer', 'render.mjs'), path.join(p.dir, 'spec.json'), p.dir], { encoding: 'utf8' });
    console.log(r.status === 0 ? '  re-rendered' : '  FAILED ' + r.stderr.slice(-200));
    console.log((r.stderr || '').split('\n').filter((l) => /judge/.test(l)).join('\n'));
  }
}
