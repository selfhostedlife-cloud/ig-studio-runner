const ROOT = process.env.IG_ROOT || 'C:/Users/smfab/ig-automation';
import fs from 'node:fs';
const KEY = fs.readFileSync((ROOT + '/.env'), 'utf8').match(/^BUFFER_API_KEY=(.*)$/m)[1].trim();
const gql = async (query, variables) => (await (await fetch('https://api.buffer.com', { method: 'POST', headers: { 'Content-Type': 'application/json' , Authorization: `Bearer ${KEY}` }, body: JSON.stringify({ query, variables }) })).json());
const names = { '6ac275fa6a5c39ccb6114033': 'TEST @exportimportwithfaizan', '6ac3579d6a5c39ccb61c8bad': 'MAIN @faizanali.shahji' };
const r = await gql(`query($i: PostsInput!){ posts(first: 30, input:$i){ edges { node { id status dueAt channelId schedulingType text assets { source } } } } }`,
  { i: { organizationId: '5ab46e7a0b3b3a6f31ae27a4', filter: { status: ['scheduled', 'draft', 'needs_approval'] } } });
if (r.errors) { console.log(JSON.stringify(r.errors).slice(0, 300)); process.exit(1); }
const ist = (d) => new Date(d).toLocaleString('en-GB', { timeZone: 'Asia/Kolkata', weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }) + ' IST';
const rows = r.data.posts.edges.map((e) => e.node).sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt));
console.log('queued posts:', rows.length, '(free plan limit 10 total)');
for (const n of rows) console.log(`[${n.status}] ${ist(n.dueAt)} | ${names[n.channelId] || n.channelId} | ${n.assets.length} slides | ${n.id} | ${JSON.stringify((n.text || '').split('\n')[0].slice(0, 55))}`);
