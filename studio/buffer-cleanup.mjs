const ROOT = process.env.IG_ROOT || 'C:/Users/smfab/ig-automation';
// Finds leftover API TEST drafts, reports where thumbnails are hosted, then deletes only those drafts.
import fs from 'node:fs';
const KEY = fs.readFileSync((ROOT + '/.env'), 'utf8').match(/^BUFFER_API_KEY=(.*)$/m)[1].trim();
const gql = async (query, variables) => (await (await fetch('https://api.buffer.com', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` }, body: JSON.stringify({ query, variables }) })).json());
const ORG = '5ab46e7a0b3b3a6f31ae27a4';

const list = await gql(`query($i: PostsInput!){ posts(first: 20, input:$i){ edges { node { id text status dueAt assets { source thumbnail } } } } }`,
  { i: { organizationId: ORG, filter: { status: ['draft'] } } });
if (list.errors) { console.log('list error:', JSON.stringify(list.errors).slice(0, 500)); process.exit(2); }
const nodes = (list.data.posts.edges || []).map((e) => e.node);
console.log('drafts found:', nodes.length);
for (const n of nodes) {
  const isTest = (n.text || '').startsWith('API TEST DRAFT');
  console.log('-', n.id, '|', JSON.stringify((n.text || '').slice(0, 40)), '| test:', isTest, '| thumb hosts:', [...new Set(n.assets.map((a) => new URL(a.thumbnail).host))].join(','), '| source hosts:', [...new Set(n.assets.map((a) => new URL(a.source).host))].join(','));
  if (isTest) {
    const d = await gql(`mutation($i: DeletePostInput!){ deletePost(input:$i){ __typename } }`, { i: { id: n.id } });
    console.log('  deletePost ->', d.errors ? JSON.stringify(d.errors).slice(0, 300) : d.data.deletePost.__typename);
  }
}
