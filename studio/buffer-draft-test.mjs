const ROOT = process.env.IG_ROOT || 'C:/Users/smfab/ig-automation';
// SAFE TEST: creates a DRAFT carousel in Buffer (never published), inspects assets, deletes it.
import fs from 'node:fs';
import { openTunnel } from './tunnel.mjs';

const KEY = fs.readFileSync((ROOT + '/.env'), 'utf8').match(/^BUFFER_API_KEY=(.*)$/m)[1].trim();
const gql = async (query, variables) => (await (await fetch('https://api.buffer.com', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` }, body: JSON.stringify({ query, variables }) })).json());

const CHANNEL = '6ac275fa6a5c39ccb6114033';
const DIR = (ROOT + '/out/sample');
const files = ['slide_01.jpg', 'slide_02.jpg', 'slide_03.jpg'];

const tunnel = await openTunnel(DIR);
console.log('tunnel open');
await new Promise((r) => setTimeout(r, 3000));
const urls = files.map((f) => tunnel.url(f));

const CREATE = `mutation($i: CreatePostInput!){ createPost(input:$i){
  __typename
  ... on PostActionSuccess { post { id status schedulingType shareMode dueAt sentAt text assets { id type mimeType source thumbnail } metadata { __typename } } }
  ... on InvalidInputError { message } ... on LimitReachedError { message } ... on UnauthorizedError { message } ... on UnexpectedError { message } ... on NotFoundError { message } ... on RestProxyError { message }
} }`;
const input = {
  channelId: CHANNEL,
  text: 'API TEST DRAFT - not for publishing',
  assets: urls.map((u) => ({ image: { url: u } })),
  mode: 'customScheduled',
  dueAt: '2027-01-15T10:00:00.000Z',
  schedulingType: 'notification',
  saveToDraft: true,
  needsApproval: false,
  source: 'n8n-studio-test',
  metadata: { instagram: { type: 'post', shouldShareToFeed: true } },
};
const res = await gql(CREATE, { i: input });
if (res.errors) console.log('GraphQL errors:', JSON.stringify(res.errors).slice(0, 700));
const p = res.data?.createPost;
console.log('createPost ->', p?.__typename, p?.message || '');
let postId = p?.post?.id;
if (p?.post) {
  console.log('status:', p.post.status, '| schedulingType:', p.post.schedulingType, '| mode:', p.post.shareMode, '| due:', p.post.dueAt, '| sentAt:', p.post.sentAt);
  p.post.assets.forEach((a, i) => console.log(` asset ${i + 1}:`, a.type, a.mimeType, '| source host:', new URL(a.source).host));
}

// give Buffer time to ingest, then close tunnel and re-check whether assets still resolve
await new Promise((r) => setTimeout(r, 15000));
tunnel.close();
console.log('tunnel closed');
await new Promise((r) => setTimeout(r, 3000));
if (postId) {
  const chk = await gql(`query($i: PostInput!){ post(input:$i){ id status assets { source thumbnail mimeType } } }`, { i: { id: postId } });
  const post = chk.data?.post;
  console.log('re-read post:', chk.errors ? JSON.stringify(chk.errors).slice(0, 300) : post?.status);
  for (const a of post?.assets || []) {
    let code = 'n/a'; try { code = (await fetch(a.source, { method: 'HEAD' })).status; } catch (e) { code = 'err ' + e.message; }
    console.log(' asset after tunnel closed:', new URL(a.source).host, '->', code);
  }
  const del = await gql(`mutation($i: DeletePostInput!){ deletePost(input:$i){ __typename ... on PostActionSuccess { post { id } } ... on InvalidInputError { message } ... on NotFoundError { message } } }`, { i: { id: postId } });
  console.log('deletePost ->', del.errors ? JSON.stringify(del.errors).slice(0, 300) : del.data.deletePost.__typename);
}
