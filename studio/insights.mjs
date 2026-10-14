const ROOT = process.env.IG_ROOT || 'C:/Users/smfab/ig-automation';
// Insights loop (multi-account): reads per-post metrics from Buffer for BOTH Instagram channels, links each studio post
// to its Buffer posts (by caption first line), snapshots results at 24h/72h/7d and writes data/learnings.json.
import fs from 'node:fs';
import path from 'node:path';

const dataDir = (ROOT + '/studio/data');
const env = fs.readFileSync((ROOT + '/.env'), 'utf8');
const KEY = (env.match(/^BUFFER_API_KEY=(.*)$/m) || [])[1]?.trim();
const ORG = '5ab46e7a0b3b3a6f31ae27a4';
export const CHANNELS = { test: '6ac275fa6a5c39ccb6114033', main: '6ac3579d6a5c39ccb61c8bad' };
const NAME = { [CHANNELS.test]: 'test @exportimportwithfaizan', [CHANNELS.main]: 'main @faizanali.shahji' };
const COOL = (ROOT + '/studio/data/buffer-cooldown.json'); // after a RATE_LIMIT error, stay away from Buffer's API for 3 hours
const gql = async (query, variables) => {
  try { const until = JSON.parse(fs.readFileSync(COOL, 'utf8')).until; if (until > Date.now()) return { errors: [{ message: 'buffer cooldown active (rate limit) until ' + new Date(until).toISOString() }] }; } catch { /* no cooldown */ }
  const j = await (await fetch('https://api.buffer.com', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` }, body: JSON.stringify({ query, variables }) })).json();
  if (JSON.stringify(j.errors || '').includes('RATE_LIMIT')) fs.writeFileSync(COOL, JSON.stringify({ until: Date.now() + 3 * 3600e3, at: new Date().toISOString() }));
  return j;
};
const med = (a) => { a = [...a].sort((x, y) => x - y); return a.length ? a[Math.floor(a.length / 2)] : 0; };
const readJson = (f, d) => { try { return JSON.parse(fs.readFileSync(path.join(dataDir, f), 'utf8')); } catch { return d; } };
const writeJson = (f, o) => fs.writeFileSync(path.join(dataDir, f), JSON.stringify(o, null, 2));
const firstLine = (t) => String(t || '').split('\n')[0].trim();

export async function pullHistory() {
  const rows = [];
  for (const channelId of Object.values(CHANNELS)) {
    let after = null;
    for (let page = 0; page < 10; page++) {
      const r = await gql(`query($i: PostsInput!, $a: String){ posts(first: 50, after: $a, input:$i){ edges { node { id sentAt text externalLink assets { type } metadata { ... on InstagramPostMetadata { type } } metrics { type value } } } pageInfo { hasNextPage endCursor } } }`,
        { i: { organizationId: ORG, filter: { channelIds: [channelId], status: ['sent'] } }, a: after });
      if (r.errors) throw new Error('Buffer: ' + JSON.stringify(r.errors).slice(0, 200));
      for (const { node: n } of r.data.posts.edges) {
        const m = Object.fromEntries((n.metrics || []).map((x) => [x.type, x.value]));
        rows.push({ id: n.id, channelId, sentAt: n.sentAt, text: n.text, link: n.externalLink, kind: n.metadata?.type || null, assets: (n.assets || []).length, ...m });
      }
      if (!r.data.posts.pageInfo.hasNextPage) break;
      after = r.data.posts.pageInfo.endCursor;
    }
  }
  writeJson('history.json', rows);
  return rows;
}

// Links each studio post to its Buffer posts on every channel (scheduled or sent) by caption first line.
async function matchBufferIds(state, history) {
  const pool = [...history];
  for (const channelId of Object.values(CHANNELS)) {
    const r = await gql(`query($i: PostsInput!){ posts(first: 50, input:$i){ edges { node { id status dueAt text } } } }`,
      { i: { organizationId: ORG, filter: { channelIds: [channelId], status: ['scheduled'] } } });
    for (const { node } of r.data?.posts?.edges || []) pool.push({ ...node, channelId });
  }
  const live = new Set(pool.map((b) => b.id));
  for (const p of state.posts) {
    let first = '';
    try { first = firstLine(fs.readFileSync(path.join(p.dir, 'caption.txt'), 'utf8')); } catch { continue; }
    p.buffer = (p.buffer || []).filter((e) => live.has(e.bufferId)); // drop links to deleted/replaced posts
    for (const channelId of Object.values(CHANNELS)) {
      for (const hit of pool.filter((b) => b.channelId === channelId && firstLine(b.text) === first)) {
        if (!p.buffer.find((e) => e.bufferId === hit.id)) p.buffer.push({ channelId, account: NAME[channelId], bufferId: hit.id, dueAt: hit.dueAt || hit.sentAt || null });
      }
    }
    const dues = p.buffer.map((e) => e.dueAt).filter(Boolean).sort();
    if (dues.length) { p.dueAt = dues[0]; p.status = 'scheduled'; }
    delete p.bufferId;
  }
}

// Returns {messages:[...], updated:n}. Mutates state posts (metrics snapshots).
export async function syncInsights(state) {
  const history = await pullHistory();
  await matchBufferIds(state, history);
  const baseline = {};
  for (const [name, channelId] of Object.entries(CHANNELS)) {
    const car = history.filter((p) => p.channelId === channelId && p.kind === 'post');
    baseline[name] = { n: car.length, views: med(car.map((p) => p.views || 0)), shares: med(car.map((p) => p.shares || 0)), saves: med(car.map((p) => p.saves || 0)) };
  }
  const messages = []; let updated = 0, decisive = 0;
  const learnings = readJson('learnings.json', { posts: [] });
  learnings.baseline = baseline;

  for (const p of state.posts) {
    p.metrics ||= {};
    for (const e of p.buffer || []) {
      const hit = history.find((h) => h.id === e.bufferId);
      if (!hit || !hit.sentAt) continue;
      const acct = e.account.split(' ')[0];
      const base = baseline[acct] || baseline.test;
      const ageH = (Date.now() - new Date(hit.sentAt).getTime()) / 3600e3;
      p.metrics[acct] ||= {};
      for (const [label, minH] of [['h6', 6], ['h24', 24], ['h72', 72], ['d7', 168]]) {
        if (ageH >= minH && !p.metrics[acct][label]) {
          const snap = { at: new Date().toISOString(), views: hit.views ?? 0, likes: hit.reactions ?? hit.likes ?? 0, comments: hit.comments ?? 0, shares: hit.shares ?? 0, saves: hit.saves ?? 0, follows: hit.follows ?? null, engagementRate: hit.engagementRate ?? null };
          snap.saveShareRate = snap.views ? +(((snap.saves + snap.shares) / snap.views) * 100).toFixed(2) : 0;
          snap.ageH = +ageH.toFixed(1);
          p.metrics[acct][label] = snap; updated++; if (label !== 'h6') decisive++;
          if (label === 'h6') continue; // early-velocity snapshot: stored silently, the model uses h24 as the decision point
          const vs = (a, b) => (b ? `${a >= b ? '+' : ''}${Math.round(((a - b) / b) * 100)}% vs that account's carousel median` : '');
          messages.push(`Results after ${label.toUpperCase()} [${e.account}]: "${p.topic}"\nViews ${snap.views} (${vs(snap.views, base.views)})\nSaves ${snap.saves} (${vs(snap.saves, base.saves)})\nShares ${snap.shares} (${vs(snap.shares, base.shares)})\nComments ${snap.comments} | Likes ${snap.likes} | Follows ${snap.follows ?? 'n/a'}\nSave+share rate ${snap.saveShareRate}% | Engagement ${snap.engagementRate ?? 'n/a'}%\nCheck how many commented "${p.keyword}".`);
        }
      }
    }
    const idx = learnings.posts.findIndex((x) => x.id === p.id);
    const entry = { id: p.id, topic: p.topic, hook: p.hook, keyword: p.keyword, accounts: (p.buffer || []).map((e) => e.account), metrics: p.metrics };
    if (idx >= 0) learnings.posts[idx] = entry; else learnings.posts.push(entry);
  }
  writeJson('learnings.json', learnings);
  return { messages, updated, decisive, historyCount: history.length, baseline };
}

// Exact lookup of the given Buffer post ids (entries with .bufferId); returns the ones that are published, with their Instagram link. One call per post.
export async function sentByIds(entries) {
  const out = [];
  for (const e of entries) {
    const r = await gql('query($i: PostInput!){ post(input:$i){ id status sentAt externalLink } }', { i: { id: e.bufferId } });
    if (r.errors) throw new Error('Buffer: ' + JSON.stringify(r.errors).slice(0, 200));
    const n = r.data?.post;
    if (n?.status === 'sent' && n.sentAt) out.push({ id: n.id, sentAt: n.sentAt, externalLink: n.externalLink, channelId: e.channelId, account: e.account });
  }
  return out;
}

// Posts Buffer has already published in the last N hours (both channels), with their Instagram links.
export async function recentSent(hours = 48) {
  const since = Date.now() - hours * 3600e3;
  const out = [];
  for (const channelId of Object.values(CHANNELS)) {
    const r = await gql(`query($i: PostsInput!){ posts(first: 20, input:$i){ edges { node { id sentAt externalLink text } } } }`,
      { i: { organizationId: ORG, filter: { channelIds: [channelId], status: ['sent'] }, sort: [{ field: 'sentAt', direction: 'desc' }] } });
    if (r.errors) { const r2 = await gql(`query($i: PostsInput!){ posts(first: 20, input:$i){ edges { node { id sentAt externalLink text } } } }`, { i: { organizationId: ORG, filter: { channelIds: [channelId], status: ['sent'] } } }); if (r2.errors) throw new Error('Buffer: ' + JSON.stringify(r2.errors).slice(0, 200)); r.data = r2.data; }
    for (const { node } of r.data.posts.edges) if (node.sentAt && new Date(node.sentAt).getTime() >= since) out.push({ ...node, channelId, account: NAME[channelId] });
  }
  return out;
}
