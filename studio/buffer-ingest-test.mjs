const ROOT = process.env.IG_ROOT || 'C:/Users/smfab/ig-automation';
// SAFE TEST: far-future notification-only scheduled post. Checks whether Buffer re-hosts images; always deletes the post.
import fs from 'node:fs';
import { openTunnel } from './tunnel.mjs';
const KEY = fs.readFileSync((ROOT + '/.env'), 'utf8').match(/^BUFFER_API_KEY=(.*)$/m)[1].trim();
const gql = async (query, variables) => (await (await fetch('https://api.buffer.com', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` }, body: JSON.stringify({ query, variables }) })).json());
const CH = '6ac275fa6a5c39ccb6114033', ORG = '5ab46e7a0b3b3a6f31ae27a4';
const DIR = (ROOT + '/out/sample');

const hosts = (post) => (post.assets || []).map((a) => { try { return new URL(a.source).host + ' / thumb ' + new URL(a.thumbnail).host; } catch { return 'n/a'; } });
const tunnel = await openTunnel(DIR);
await new Promise((r) => setTimeout(r, 4000));
let postId = null;
try {
  const res = await gql(`mutation($i: CreatePostInput!){ createPost(input:$i){ __typename ... on PostActionSuccess { post { id status schedulingType dueAt assets { source thumbnail } } } ... on InvalidInputError { message } ... on UnexpectedError { message } } }`, {
    i: { channelId: CH, text: 'API INGEST TEST - far future, notification only', assets: ['slide_01.jpg', 'slide_02.jpg'].map((f) => ({ image: { url: tunnel.url(f) } })),
      mode: 'customScheduled', dueAt: '2027-01-15T10:00:00.000Z', schedulingType: 'notification', saveToDraft: false, needsApproval: false,
      source: 'n8n-studio-test', metadata: { instagram: { type: 'post', shouldShareToFeed: true } } } });
  const p = res.data?.createPost;
  console.log('create ->', p?.__typename, p?.message || '', '| status:', p?.post?.status);
  postId = p?.post?.id;
  if (p?.post) console.log('right after create, asset hosts:', hosts(p.post).join(' ; '));
  for (const wait of [20, 40]) {
    await new Promise((r) => setTimeout(r, wait * 1000));
    const q = await gql(`query($i: PostInput!){ post(input:$i){ status assets { source thumbnail } } }`, { i: { id: postId } });
    console.log(`after +${wait}s: status ${q.data?.post?.status} | hosts: ${hosts(q.data.post).join(' ; ')}`);
  }
} finally {
  tunnel.close();
  if (postId) {
    const d = await gql(`mutation($i: DeletePostInput!){ deletePost(input:$i){ __typename } }`, { i: { id: postId } });
    console.log('delete ->', d.errors ? JSON.stringify(d.errors).slice(0, 200) : d.data.deletePost.__typename);
  }
  const left = await gql(`query($i: PostsInput!){ posts(first: 20, input:$i){ edges { node { id text status } } } }`, { i: { organizationId: ORG, filter: { channelIds: [CH], status: ['scheduled', 'draft'] } } });
  const test = (left.data?.posts?.edges || []).map((e) => e.node).filter((n) => /INGEST TEST|API TEST/.test(n.text || ''));
  console.log('leftover test posts:', test.length);
}
