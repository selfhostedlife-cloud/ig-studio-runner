// Copies each approved/scheduled post's lead-magnet PDF into the shared Drive folder as "KEYWORD - Title.pdf" (skips ones already there).
import fs from 'node:fs';
import path from 'node:path';
const DRIVE = 'H:/My Drive/Freebies for IG Studio';
const state = JSON.parse(fs.readFileSync(path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), 'data', 'state.json'), 'utf8'));
const have = fs.readdirSync(DRIVE);
for (const p of state.posts) {
  if (!['approved', 'scheduled'].includes(p.status)) continue;
  const pdf = fs.readdirSync(p.dir).find((f) => f.endsWith('.pdf'));
  if (!pdf) { console.log('#' + p.no, p.keyword, 'no pdf'); continue; }
  let title = pdf.replace(/\.pdf$/, '');
  try { title = JSON.parse(fs.readFileSync(path.join(p.dir, 'leadmagnet.json'), 'utf8')).title || title; } catch { /* keep */ }
  const name = String(p.keyword).toUpperCase() + ' - ' + title.replace(/[\/:*?"<>|]/g, '') + '.pdf';
  if (have.includes(name) || have.some((h) => h.startsWith(String(p.keyword).toUpperCase() + ' - ') && h.length > 12 && p.no <= 4)) { console.log('#' + p.no, p.keyword, 'already in Drive'); continue; }
  fs.copyFileSync(path.join(p.dir, pdf), path.join(DRIVE, name));
  console.log('#' + p.no, p.keyword, 'copied ->', name);
}
