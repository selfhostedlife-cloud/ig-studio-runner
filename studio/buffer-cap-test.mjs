const ROOT = process.env.IG_ROOT || 'C:/Users/smfab/ig-automation';
// SAFE TEST: how many images can one Instagram carousel have in Buffer? Far-future notification-only posts, deleted immediately.
import fs from 'node:fs';
import { openTunnel } from './tunnel.mjs';
const KEY = fs.readFileSync((ROOT + '/.env'), 'utf8').match(/^BUFFER_API_KEY=(.*)$/m)[1].trim();
const gql = async (query, variables) => (await (await fetch('https://api.buffer.com', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` }, body: JSON.stringify({ query, variables }) })).json());
const CH = '6ac275fa6a5c39ccb6114033';
const tunnel = await openTunnel((ROOT + '/out/posts/v2-germany'));
await new Promise((r) => setTimeout(r, 3500));
try {
  for (const n of [11, 15, 20, 21]) {
    const urls = Array.from({ length: n }, (_, i) => tunnel.url(`slide_0${(i % 7) + 1}.jpg`) + `?n=${i}`);
    const res = await gql(`mutation($i: CreatePostInput!){ createPost(input:$i){ __typename ... on PostActionSuccess { post { id assets { source } } } ... on InvalidInputError { message } ... on UnexpectedError { message } ... on LimitReachedError { message } } }`, {
      i: { channelId: CH, text: `API CAP TEST ${n} - far future, notification only`, assets: urls.map((u) => ({ image: { url: u } })), mode: 'customScheduled', dueAt: '2027-01-15T10:00:00.000Z', schedulingType: 'notification', saveToDraft: false, needsApproval: false, source: 'n8n-studio-test', metadata: { instagram: { type: 'post', shouldShareToFeed: true } } } });
    const p = res.data?.createPost;
    console.log(`${n} images ->`, p?.__typename, (p?.message || '').slice(0, 160), res.errors ? JSON.stringify(res.errors).slice(0, 160) : '');
    if (p?.post?.id) { console.log('   stored assets:', p.post.assets.length); await gql(`mutation($i: DeletePostInput!){ deletePost(input:$i){ __typename } }`, { i: { id: p.post.id } }); }
  }
} finally {
  tunnel.close();
  const left = await gql(`query($i: PostsInput!){ posts(first: 30, input:$i){ edges { node { id text } } } }`, { i: { organizationId: '5ab46e7a0b3b3a6f31ae27a4', filter: { channelIds: [CH], status: ['scheduled', 'draft'] } } });
  const stray = (left.data?.posts?.edges || []).map((e) => e.node).filter((n) => /CAP TEST/.test(n.text || ''));
  for (const s of stray) await gql(`mutation($i: DeletePostInput!){ deletePost(input:$i){ __typename } }`, { i: { id: s.id } });
  console.log('leftover test posts cleaned:', stray.length);
}
