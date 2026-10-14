const ROOT = process.env.IG_ROOT || 'C:/Users/smfab/ig-automation';
// Probe Buffer's GraphQL API: auth, schema (root fields), organizations/channels.
import fs from 'node:fs';
const env = fs.readFileSync((ROOT + '/.env'), 'utf8');
const KEY = env.match(/^BUFFER_API_KEY=(.*)$/m)[1].trim();
const URLS = ['https://api.buffer.com', 'https://api.buffer.com/graphql'];

async function gql(url, query, variables) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` }, body: JSON.stringify({ query, variables }) });
  const text = await r.text();
  let json; try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 300) }; }
  return { status: r.status, json };
}

let url = null;
for (const u of URLS) {
  const r = await gql(u, '{ __typename }');
  console.log(u, '->', r.status, JSON.stringify(r.json).slice(0, 160));
  if (r.status === 200 && r.json.data) { url = u; break; }
}
if (!url) process.exit(2);

const q = await gql(url, '{ __schema { queryType { fields { name args { name } type { name kind ofType { name } } } } mutationType { fields { name } } } }');
if (q.json.errors) console.log('introspection:', JSON.stringify(q.json.errors).slice(0, 300));
else {
  console.log('QUERY fields:', q.json.data.__schema.queryType.fields.map((f) => f.name + '(' + f.args.map((a) => a.name).join(',') + ')').join(' | '));
  console.log('MUTATIONS:', (q.json.data.__schema.mutationType?.fields || []).map((f) => f.name).join(', '));
}
