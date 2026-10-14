const ROOT = process.env.IG_ROOT || 'C:/Users/smfab/ig-automation';
import fs from 'node:fs';
const KEY = fs.readFileSync((ROOT + '/.env'), 'utf8').match(/^BUFFER_API_KEY=(.*)$/m)[1].trim();
const gql = async (query, variables) => (await (await fetch('https://api.buffer.com', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` }, body: JSON.stringify({ query, variables }) })).json());
const r = await gql(`query($i: PostsInput!){ posts(first: 20, input:$i){ edges { node { id status dueAt schedulingType shareMode text assets { source thumbnail mimeType } metadata { ... on InstagramPostMetadata { type shouldShareToFeed } } } } } }`,
  { i: { organizationId: '5ab46e7a0b3b3a6f31ae27a4', filter: { channelIds: ['6ac275fa6a5c39ccb6114033'], status: ['scheduled', 'draft', 'needs_approval'] } } });
if (r.errors) { console.log(JSON.stringify(r.errors).slice(0, 400)); process.exit(1); }
const ist = (d) => new Date(d).toLocaleString('en-GB', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }) + ' IST';
for (const { node: n } of r.data.posts.edges) {
  console.log(`\n[${n.status}] ${n.id} | due ${ist(n.dueAt)} | ${n.schedulingType} | ${n.shareMode} | IG type: ${n.metadata?.type} | assets: ${n.assets.length}`);
  console.log('  text:', JSON.stringify((n.text || '').slice(0, 90)), '... hashtags:', ((n.text || '').match(/#\w+/g) || []).length);
  console.log('  asset hosts:', [...new Set(n.assets.map((a) => { try { return new URL(a.source).host; } catch { return '?'; } }))].join(', '), '| mime:', [...new Set(n.assets.map((a) => a.mimeType))].join(','));
}
