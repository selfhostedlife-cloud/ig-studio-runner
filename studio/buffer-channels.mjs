const ROOT = process.env.IG_ROOT || 'C:/Users/smfab/ig-automation';
import fs from 'node:fs';
const KEY = fs.readFileSync((ROOT + '/.env'), 'utf8').match(/^BUFFER_API_KEY=(.*)$/m)[1].trim();
const gql = async (query, variables) => (await (await fetch('https://api.buffer.com', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` }, body: JSON.stringify({ query, variables }) })).json());

const a = await gql('{ account { id email timezone organizations { id name } } }');
if (a.errors) { console.log('account error:', JSON.stringify(a.errors).slice(0, 400)); process.exit(2); }
const acct = a.data.account;
console.log('account email:', acct.email.replace(/^(.).*(@.*)$/, '$1***$2'), '| tz:', acct.timezone, '| orgs:', acct.organizations.map((o) => `${o.name} (${o.id})`).join(', '));
for (const o of acct.organizations) {
  const c = await gql(`query($i: ChannelsInput!){ channels(input:$i){ id name displayName service serviceId type timezone isDisconnected isLocked isQueuePaused scopes allowedActions descriptor } }`, { i: { organizationId: o.id } });
  if (c.errors) { console.log('channels error:', JSON.stringify(c.errors).slice(0, 400)); continue; }
  for (const ch of c.data.channels) console.log(JSON.stringify(ch));
}
