const ROOT = process.env.IG_ROOT || 'C:/Users/smfab/ig-automation';
// Results chart image for one account: bars of 24h views per post (each with its own cover as a tiny preview, "PIP"),
// the account's normal level and the 50K goal, growth curves (6h -> 24h -> 72h -> 7d), and what the learning model changed.
// Usage: node results-image.mjs <main|test> <out.png>
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const [acct, outFile] = process.argv.slice(2);
if (!['main', 'test'].includes(acct) || !outFile) { console.error('usage: node results-image.mjs <main|test> <out.png>'); process.exit(1); }
const dataDir = (ROOT + '/studio/data');
const rd = (f, d) => { try { return JSON.parse(fs.readFileSync(path.join(dataDir, f), 'utf8')); } catch { return d; } };
const state = rd('state.json', { posts: [] });
const model = rd('learning-model.json', null);
const live = rd('playbook-live.json', null);
const baseline = (model?.baseline || rd('learnings.json', {}).baseline || {})[acct] || {};
const handle = acct === 'main' ? '@faizanali.shahji' : '@exportimportwithfaizan';
const GOAL = 50000;
const esc = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const k = (n) => (n >= 10000 ? (n / 1000).toFixed(n >= 100000 ? 0 : 1).replace(/\.0$/, '') + 'K' : n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K' : String(Math.round(n)));
const fixHook = (t) => String(t || '').replace(/â‚¹/g, 'Rs ').replace(/\s+/g, ' ').trim();
const thumb = (p) => { try { return 'data:image/jpeg;base64,' + fs.readFileSync(path.join(p.dir, 'slide_01.jpg')).toString('base64'); } catch { return ''; } };

// posts that have numbers for this account (oldest -> newest), last 8
const rows = state.posts.map((p) => {
  const m = p.metrics?.[acct] || {};
  const snaps = [['6h', m.h6], ['24h', m.h24], ['72h', m.h72], ['7d', m.d7]].filter(([, v]) => v && v.views != null).map(([l, v]) => ({ l, views: v.views, saves: v.saves, shares: v.shares }));
  const e = (p.buffer || []).find((x) => String(x.account).startsWith(acct));
  return { no: p.no, kw: String(p.keyword || ''), hook: fixHook(p.hook), when: e?.dueAt || p.dueAt || '', snaps, v24: m.h24?.views ?? m.h72?.views ?? m.d7?.views ?? null, img: thumb(p) };
}).filter((r) => r.snaps.length).sort((a, b) => a.no - b.no).slice(-8);

const base = baseline.views || 0;
const finished = rows.filter((r) => r.v24 != null);
const best = finished.reduce((b, r) => (r.v24 > (b?.v24 || 0) ? r : b), null);
const maxBar = Math.max(base * 1.3, ...finished.map((r) => r.v24), 100);

// ---- bar chart (HTML/CSS) ----
const barsHtml = rows.length ? rows.map((r) => {
  const v = r.v24; const h = v == null ? 0 : Math.max(4, Math.round((v / maxBar) * 250));
  const good = v != null && base && v >= base;
  return `<div class="col"><div class="val">${v == null ? (r.snaps.length ? k(r.snaps[r.snaps.length - 1].views) + '*' : '-') : k(v)}</div>
    <div class="bar ${v == null ? 'prov' : good ? 'good' : 'low'}" style="height:${v == null ? Math.max(4, Math.round(((r.snaps[0]?.views || 0) / maxBar) * 250)) : h}px"></div>
    <img class="pip" src="${r.img}"><div class="no">#${r.no} ${esc(r.kw)}</div><div class="hk">${esc(r.hook.slice(0, 44))}</div></div>`;
}).join('') : '<div class="empty">No results for this account yet. Charts fill in once the first post has run for 24 hours.</div>';
const baseLineY = base ? Math.round((base / maxBar) * 250) : null;

// ---- growth curves (SVG) ----
const curveRows = rows.filter((r) => r.snaps.length >= 2).slice(-4);
const labels = ['6h', '24h', '72h', '7d'];
const W = 1100, H = 300, padL = 70, padR = 150, padT = 20, padB = 40;
const cmax = Math.max(...curveRows.flatMap((r) => r.snaps.map((s) => s.views)), base, 100) * 1.1;
const X = (l) => padL + (labels.indexOf(l) / 3) * (W - padL - padR);
const Y = (v) => padT + (1 - v / cmax) * (H - padT - padB);
const palette = ['#F5B82E', '#34F5B0', '#8B7BFF', '#FF6B6B'];
let svg = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">`;
for (let i = 0; i <= 4; i++) { const v = (cmax / 4) * i; svg += `<line x1="${padL}" x2="${W - padR}" y1="${Y(v)}" y2="${Y(v)}" stroke="#2A3558" stroke-width="1"/><text x="${padL - 10}" y="${Y(v) + 5}" fill="#8F9BC2" font-size="17" text-anchor="end">${k(v)}</text>`; }
for (const l of labels) svg += `<text x="${X(l)}" y="${H - 10}" fill="#8F9BC2" font-size="18" text-anchor="middle">${l}</text>`;
if (base) svg += `<line x1="${padL}" x2="${W - padR}" y1="${Y(base)}" y2="${Y(base)}" stroke="#8F9BC2" stroke-dasharray="7 6" stroke-width="2"/><text x="${W - padR + 8}" y="${Y(base) - 6}" fill="#8F9BC2" font-size="16">your normal</text>`;
const pipsSvg = [];
curveRows.forEach((r, i) => {
  const col = palette[i % palette.length];
  const pts = r.snaps.map((s) => `${X(s.l)},${Y(s.views)}`).join(' ');
  svg += `<polyline points="${pts}" fill="none" stroke="${col}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"/>`;
  for (const s of r.snaps) svg += `<circle cx="${X(s.l)}" cy="${Y(s.views)}" r="6" fill="${col}"/>`;
  const last = r.snaps[r.snaps.length - 1];
  pipsSvg.push(`<div class="cpip" style="left:${X(last.l) + 18}px;top:${Y(last.views) - 26}px;border-color:${col}"><img src="${r.img}"><span style="color:${col}">#${r.no} ${k(last.views)}</span></div>`);
});
svg += '</svg>';
const curveHtml = curveRows.length ? `<div class="curvewrap">${svg}${pipsSvg.join('')}</div>` : '<div class="empty">Growth curves appear once a post has two or more readings (6h, 24h, 72h, 7d).</div>';

// ---- learning panel ----
const clip = (t, n) => { t = String(t); if (t.length <= n) return t; const c = t.slice(0, n); return c.slice(0, c.lastIndexOf(' ')).replace(/[,;:(s]+$/, '') + '...'; };
const li = (arr) => (arr || []).slice(0, 3).map((x) => `<li>${esc(clip(x, 170))}</li>`).join('');
const learnHtml = live ? `<div class="two"><div><h3>Doing more of</h3><ul>${li(live.double_down)}</ul></div><div><h3>Stopping</h3><ul>${li(live.stop)}</ul></div></div>
  <div class="exp"><h3>Testing next</h3><ul>${(live.experiments || []).slice(0, 2).map((x) => `<li><b>${esc(x.variable)}</b>: ${esc(clip(x.hypothesis, 150))}</li>`).join('')}</ul></div>` : '<div class="empty">The learning summary appears after the first analysis.</div>';

const pct = best ? Math.min(100, Math.round((best.v24 / GOAL) * 100)) : 0;
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0;padding:0}body{width:1200px;background:#0A0F1E;color:#fff;font-family:Inter,Segoe UI,Arial,sans-serif;padding:36px 50px 40px}
h1{font-size:40px;font-weight:800}h2{font-size:26px;font-weight:800;margin:34px 0 14px;color:#F5B82E}h3{font-size:20px;margin-bottom:8px;color:#C9D2F0}
.sub{color:#8F9BC2;font-size:19px;margin-top:4px}
.kpis{display:flex;gap:16px;margin-top:22px}.kpi{flex:1;background:#141C38;border-radius:16px;padding:16px 20px}.kpi b{display:block;font-size:38px;color:#F5B82E}.kpi span{font-size:16px;color:#8F9BC2}
.goal{margin-top:18px;background:#141C38;border-radius:16px;padding:16px 20px}.track{height:22px;background:#2A3558;border-radius:11px;overflow:hidden;margin-top:10px}.fill{height:100%;background:linear-gradient(90deg,#F5B82E,#34F5B0);width:${pct}%}
.chart{position:relative;display:flex;gap:14px;align-items:flex-end;height:430px;background:#141C38;border-radius:16px;padding:20px 20px 0 20px}
.col{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;min-width:0;height:100%}
.val{font-size:21px;font-weight:800;margin-bottom:5px}.bar{width:70%;border-radius:10px 10px 0 0}.bar.good{background:#34D399}.bar.low{background:#F59E0B}.bar.prov{background:repeating-linear-gradient(45deg,#5B6AA8,#5B6AA8 8px,#3A4577 8px,#3A4577 16px)}
.pip{width:62px;height:62px;object-fit:cover;border-radius:12px;border:3px solid #fff;margin-top:8px;background:#222}.no{font-size:15px;font-weight:800;margin-top:4px}.hk{font-size:12.5px;color:#8F9BC2;text-align:center;height:34px;overflow:hidden;line-height:1.2;margin-bottom:8px;width:100%}
.baseline{position:absolute;left:20px;right:20px;border-top:3px dashed #8F9BC2;pointer-events:none}.baseline span{position:absolute;right:0;top:-24px;font-size:15px;color:#8F9BC2;background:#141C38;padding:0 6px}
.curvewrap{position:relative;width:1100px;height:300px;background:#141C38;border-radius:16px;padding:0}.curvewrap svg{display:block}
.cpip{position:absolute;display:flex;align-items:center;gap:6px;background:#0A0F1E;border:3px solid;border-radius:12px;padding:3px 8px 3px 3px;font-size:15px;font-weight:800}.cpip img{width:34px;height:34px;object-fit:cover;border-radius:7px}
.panel{background:#141C38;border-radius:16px;padding:18px 24px}.two{display:flex;gap:30px}.two>div{flex:1}ul{padding-left:20px;font-size:16px;line-height:1.4;color:#E4E9FA}li{margin-bottom:6px}.exp{margin-top:12px}
.empty{background:#141C38;border-radius:16px;padding:26px;color:#8F9BC2;font-size:18px}.note{font-size:14px;color:#8F9BC2;margin-top:10px}
</style></head><body>
<h1>${esc(handle)} &mdash; results</h1><div class="sub">Updated ${new Date().toLocaleString('en-GB', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })} IST &bull; views after 24 hours</div>
<div class="kpis"><div class="kpi"><b>${best ? k(best.v24) : '-'}</b><span>best 24h views${best ? ' (#' + best.no + ')' : ''}</span></div><div class="kpi"><b>${base ? k(base) : '-'}</b><span>your normal (median)</span></div><div class="kpi"><b>${best && base ? (best.v24 / base).toFixed(1) + 'x' : '-'}</b><span>best vs normal</span></div><div class="kpi"><b>${base ? (GOAL / base).toFixed(1) + 'x' : '-'}</b><span>needed for ${k(GOAL)}</span></div></div>
<div class="goal"><div style="display:flex;justify-content:space-between;font-size:19px"><span>Goal: ${k(GOAL)} views in 24h on one post</span><b>${pct}% reached</b></div><div class="track"><div class="fill"></div></div></div>
<h2>Views per post (24h) &mdash; the small picture is that post's cover</h2>
<div class="chart">${barsHtml}${baseLineY != null && rows.length ? `<div class="baseline" style="bottom:${baseLineY + 128}px"><span>your normal ${k(base)}</span></div>` : ''}</div>
<div class="note">Green = above your normal, orange = below. Striped * = only an early reading so far.</div>
<h2>How each post grew (6h &rarr; 24h &rarr; 72h &rarr; 7d)</h2>${curveHtml}
<h2>What the system learned</h2><div class="panel">${learnHtml}</div>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 1 });
await page.setContent(html, { waitUntil: 'load' });
fs.mkdirSync(path.dirname(outFile), { recursive: true });
await page.screenshot({ path: outFile, fullPage: true });
await browser.close();
console.log(JSON.stringify({ out: outFile, posts: rows.length }));
