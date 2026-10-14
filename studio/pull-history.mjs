const ROOT = process.env.IG_ROOT || 'C:/Users/smfab/ig-automation';
// Pulls past sent Instagram posts + per-post metrics from Buffer into studio/data/history.json (read-only).
import fs from 'node:fs';
const KEY = fs.readFileSync((ROOT + '/.env'), 'utf8').match(/^BUFFER_API_KEY=(.*)$/m)[1].trim();
const gql = async (query, variables) => (await (await fetch('https://api.buffer.com', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` }, body: JSON.stringify({ query, variables }) })).json());
const ORG = '5ab46e7a0b3b3a6f31ae27a4', CH = '6ac275fa6a5c39ccb6114033';

const rows = [];
let after = null;
for (let page = 0; page < 10; page++) {
  const r = await gql(`query($i: PostsInput!, $a: String){ posts(first: 50, after: $a, input:$i){ edges { node { id sentAt text externalLink assets { type mimeType } metadata { __typename ... on InstagramPostMetadata { type } } metrics { type value } } } pageInfo { hasNextPage endCursor } } }`,
    { i: { organizationId: ORG, filter: { channelIds: [CH], status: ['sent'] } }, a: after });
  if (r.errors) { console.log('error:', JSON.stringify(r.errors).slice(0, 500)); break; }
  for (const e of r.data.posts.edges) {
    const n = e.node; const m = Object.fromEntries((n.metrics || []).map((x) => [x.type, x.value]));
    rows.push({ id: n.id, sentAt: n.sentAt, text: n.text, link: n.externalLink, kind: n.metadata?.type || null, assets: (n.assets || []).length, assetType: (n.assets || [])[0]?.type || null, ...m });
  }
  if (!r.data.posts.pageInfo.hasNextPage) break;
  after = r.data.posts.pageInfo.endCursor;
}
fs.mkdirSync((ROOT + '/studio/data'), { recursive: true });
fs.writeFileSync((ROOT + '/studio/data/history.json'), JSON.stringify(rows, null, 2));
console.log('posts pulled:', rows.length);
rows.sort((a, b) => (b.views || 0) - (a.views || 0));
for (const r of rows) console.log(`${(r.sentAt || '').slice(0, 10)} | ${r.kind || '-'} x${r.assets} ${r.assetType || ''} | views ${r.views ?? '-'} | likes ${r.reactions ?? r.likes ?? '-'} | cmts ${r.comments ?? '-'} | shares ${r.shares ?? '-'} | saves ${r.saves ?? '-'} | eng ${r.engagementRate ?? '-'}% | ${JSON.stringify((r.text || '').replace(/\s+/g, ' ').slice(0, 110))}`);
