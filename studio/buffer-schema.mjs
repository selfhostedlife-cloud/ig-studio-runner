const ROOT = process.env.IG_ROOT || 'C:/Users/smfab/ig-automation';
import fs from 'node:fs';
const KEY = fs.readFileSync((ROOT + '/.env'), 'utf8').match(/^BUFFER_API_KEY=(.*)$/m)[1].trim();
const gql = async (query, variables) => (await (await fetch('https://api.buffer.com', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` }, body: JSON.stringify({ query, variables }) })).json());

const tref = 'name kind ofType { name kind ofType { name kind ofType { name kind } } }';
const show = (t) => !t ? '' : t.kind === 'NON_NULL' ? show(t.ofType) + '!' : t.kind === 'LIST' ? '[' + show(t.ofType) + ']' : t.name;
async function typeInfo(name) {
  const r = await gql(`{ __type(name: "${name}") { name kind fields { name type { ${tref} } } inputFields { name type { ${tref} } } enumValues { name } } }`);
  const t = r.data?.__type;
  if (!t) return console.log(name, '-> not found', JSON.stringify(r.errors || '').slice(0, 200));
  console.log(`\n## ${t.name} (${t.kind})`);
  (t.fields || []).forEach((f) => console.log('  ', f.name + ': ' + show(f.type)));
  (t.inputFields || []).forEach((f) => console.log('  ', f.name + ': ' + show(f.type)));
  if (t.enumValues) console.log('   values:', t.enumValues.map((e) => e.name).join(', '));
}

// find input type names for the root fields we need
const root = await gql(`{ __schema { queryType { fields { name args { name type { ${tref} } } type { ${tref} } } } mutationType { fields { name args { name type { ${tref} } } type { ${tref} } } } } }`);
const pick = (list, n) => list.find((f) => f.name === n);
for (const [kind, n] of [['q', 'account'], ['q', 'channels'], ['q', 'aggregatedPostMetrics'], ['q', 'posts'], ['m', 'createPost']]) {
  const f = pick(root.data.__schema[kind === 'q' ? 'queryType' : 'mutationType'].fields, n);
  console.log(`${n}(${f.args.map((a) => a.name + ': ' + show(a.type)).join(', ')}) -> ${show(f.type)}`);
}
for (const n of process.argv.slice(2)) await typeInfo(n);
