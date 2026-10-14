const ROOT = process.env.IG_ROOT || 'C:/Users/smfab/ig-automation';
// Timing agent: picks each account's best posting slots from its own real results (no Gemini, no Buffer call; reads data/history.json that every insights sync refreshes).
// Evidence = every post Buffer ever sent for the account: carousels at full weight, reels at 0.6 (stories ignored).
// score = ln((views+50)/(account median for that format+50)), so a post counts relative to the account's own normal, outliers are tamed by the log.
// Per weekday: hour scores are smoothed with neighbouring hours, then shrunk toward the all-days score for that hour (few posts per exact day) and toward 0 (no evidence).
// Output data/slot-model.json: per account, per weekday 0=Sun..6=Sat, a primary slot and a backup slot; the 3 days whose backup slot scores best get 2 posts
// (7 + up to 3 = max 10 per week, the owner's weekly cap). The feeder reads this file; without it the old fixed slots are used.
// Usage: node slots.mjs [--print]
import fs from 'node:fs';
import path from 'node:path';

const dataDir = (ROOT + '/studio/data');
const CH = { test: '6ac275fa6a5c39ccb6114033', main: '6ac3579d6a5c39ccb61c8bad' };
const HOURS = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22]; // IST posting window
const K_HOUR = 3, K_DAY = 3, MIN_GAP_H = 4, SECOND_SLOTS = 3, MIN_TESTED = 3;
const rd = (f, d) => { try { return JSON.parse(fs.readFileSync(path.join(dataDir, f), 'utf8')); } catch { return d; } };
const med = (a) => { a = [...a].sort((x, y) => x - y); return a.length ? a[Math.floor(a.length / 2)] : 0; };
const pad = (h) => String(h).padStart(2, '0') + ':00';

export function buildSlotModel(history = rd('history.json', [])) {
  const out = { updated: new Date().toISOString(), method: 'shrunk log-index of views by IST hour and weekday', accounts: {} };
  for (const [name, channelId] of Object.entries(CH)) {
    const rows = history.filter((r) => r.channelId === channelId && (r.kind === 'post' || r.kind === 'reel') && r.sentAt && r.views != null);
    const base = { post: med(rows.filter((r) => r.kind === 'post').map((r) => r.views)), reel: med(rows.filter((r) => r.kind === 'reel').map((r) => r.views)) };
    const obs = rows.map((r) => { const t = new Date(new Date(r.sentAt).getTime() + 5.5 * 3600e3); return { h: t.getUTCHours(), d: t.getUTCDay(), li: Math.log((r.views + 50) / (base[r.kind] + 50)), w: r.kind === 'post' ? 1 : 0.6 }; });
    const near = (a, b) => (a === b ? 1 : Math.abs(a - b) === 1 ? 0.5 : 0);
    const hourScore = (h) => { let n = 0, s = 0; for (const o of obs) { const k = near(o.h, h) * o.w; n += k; s += k * o.li; } return s / (n + K_HOUR); };
    const cellScore = (d, h) => { let n = 0, s = 0; for (const o of obs) if (o.d === d) { const k = near(o.h, h) * o.w; n += k; s += k * o.li; } return (s + K_DAY * hourScore(h)) / (n + K_DAY); };
    const evidence = (d, h) => obs.filter((o) => o.d === d && Math.abs(o.h - h) <= 1).length;
    // only hours the account has really posted at (>= 3 posts within +-1h) are candidates: an untested hour is not evidence of a good hour
    const tested = HOURS.filter((h) => obs.filter((o) => Math.abs(o.h - h) <= 1).length >= MIN_TESTED);
    const days = {}, grid = {};
    for (let d = 0; d < 7; d++) {
      const sc = tested.map((h) => ({ h, s: cellScore(d, h) }));
      grid[d] = Object.fromEntries(sc.map((x) => [pad(x.h), +x.s.toFixed(2)]));
      const first = [...sc].sort((a, b) => b.s - a.s)[0];
      const second = [...sc].filter((x) => Math.abs(x.h - first.h) >= MIN_GAP_H).sort((a, b) => b.s - a.s)[0];
      days[d] = { primary: pad(first.h), primaryScore: +first.s.toFixed(2), primaryEvidence: evidence(d, first.h), backup: pad(second.h), backupScore: +second.s.toFixed(2), backupEvidence: evidence(d, second.h) };
    }
    const doubled = Object.entries(days).sort((a, b) => b[1].backupScore - a[1].backupScore).filter(([, x]) => x.backupScore > -0.05).slice(0, SECOND_SLOTS).map(([d]) => Number(d)); // a second post only where its slot is at least about normal for the account
    const slots = {};
    for (let d = 0; d < 7; d++) slots[d] = doubled.includes(d) ? [days[d].primary, days[d].backup].sort() : [days[d].primary];
    out.accounts[name] = { posts: rows.filter((r) => r.kind === 'post').length, reels: rows.filter((r) => r.kind === 'reel').length, medianViews: base, days, grid, doubledDays: doubled, slots };
  }
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1'))) {
  const model = buildSlotModel();
  fs.writeFileSync(path.join(dataDir, 'slot-model.json'), JSON.stringify(model, null, 2));
  const DN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  for (const [name, a] of Object.entries(model.accounts)) {
    console.log(`\n${name}: ${a.posts} carousels + ${a.reels} reels (median views ${a.medianViews.post} / ${a.medianViews.reel})`);
    for (const d of [1, 2, 3, 4, 5, 6, 0]) { const x = a.days[d]; console.log(`  ${DN[d]}  ${a.slots[d].join(' + ').padEnd(13)} primary ${x.primary} (score ${x.primaryScore}, ${x.primaryEvidence} nearby posts)  backup ${x.backup} (${x.backupScore}, ${x.backupEvidence})`); }
  }
}
