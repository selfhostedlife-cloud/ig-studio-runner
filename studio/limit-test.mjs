const ROOT = process.env.IG_ROOT || 'C:/Users/smfab/ig-automation';
// SAFE TEST: is Buffer's free 10-scheduled-posts limit per channel or per organization? Far-future notification-only posts, all deleted at the end.
import fs from 'node:fs';
import { openTunnel } from './tunnel.mjs';
const KEY = fs.readFileSync((ROOT + '/.env'), 'utf8').match(/^BUFFER_API_KEY=(.*)$/m)[1].trim();
const gql = async (query, variables) => (await (await fetch('https://api.buffer.com', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` }, body: JSON.stringify({ query, variables }) })).json());
const CH = { test: '6ac275fa6a5c39ccb6114033', main: '6ac3579d6a5c39ccb61c8bad' };
const tunnel = await openTunnel((ROOT + '/out/posts/v2-germany'));
await new Promise((r) => setTimeout(r, 3500));
const made = [];
const mk = async (ch, n) => {
  const res = await gql(`mutation($i: CreatePostInput!){ createPost(input:$i){ __typename ... on PostActionSuccess { post { id } } ... on InvalidInputError { message } ... on UnexpectedError { message } ... on LimitReachedError { message } } }`, {
    i: { channelId: CH[ch], text: `LIMIT TEST ${ch} ${n}`, assets: [{ image: { url: tunnel.url('slide_01.jpg') + '?n=' + n } }], mode: 'customScheduled', dueAt: `2027-02-${String(10 + n).padStart(2, '0')}T10:00:00.000Z`, schedulingType: 'notification', saveToDraft: false, needsApproval: false, source: 'n8n-studio-test', metadata: { instagram: { type: 'post', shouldShareToFeed: true } } } });
  const p = res.data?.createPost;
  if (p?.post?.id) made.push(p.post.id);
  return `${ch} #${n}: ${p?.__typename} ${p?.message || ''}`;
};
try {
  for (let n = 1; n <= 10; n++) { const o = await mk('test', n); if (!/PostActionSuccess/.test(o)) { console.log(o); break; } }
  console.log('after 10 on test:', made.length, 'created');
  console.log(await mk('test', 11));
  console.log(await mk('main', 1));
} finally {
  for (const id of made) await gql(`mutation($i: DeletePostInput!){ deletePost(input:$i){ __typename } }`, { i: { id } });
  tunnel.close();
  const left = await gql(`query($i: PostsInput!){ posts(first: 50, input:$i){ edges { node { id text } } } }`, { i: { organizationId: '5ab46e7a0b3b3a6f31ae27a4', filter: { status: ['scheduled', 'draft', 'needs_approval'] } } });
  const stray = (left.data?.posts?.edges || []).map((e) => e.node).filter((n) => /LIMIT TEST/.test(n.text || ''));
  for (const s of stray) await gql(`mutation($i: DeletePostInput!){ deletePost(input:$i){ __typename } }`, { i: { id: s.id } });
  console.log('deleted', made.length, '+ stray', stray.length, '| queue now:', (left.data?.posts?.edges || []).length - stray.length);
}
