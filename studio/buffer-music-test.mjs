const ROOT = process.env.IG_ROOT || 'C:/Users/smfab/ig-automation';
// SAFE TEST: does Buffer accept a music track on an Instagram carousel post? Far-future, notification-only, deleted at the end.
import fs from 'node:fs';
import { openTunnel } from './tunnel.mjs';
const KEY = fs.readFileSync((ROOT + '/.env'), 'utf8').match(/^BUFFER_API_KEY=(.*)$/m)[1].trim();
const gql = async (query, variables) => (await (await fetch('https://api.buffer.com', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` }, body: JSON.stringify({ query, variables }) })).json());
const CH = process.argv[2] === 'main' ? '6ac3579d6a5c39ccb61c8bad' : '6ac275fa6a5c39ccb6114033';
const ORG = '5ab46e7a0b3b3a6f31ae27a4';

const s = await gql(`query($i: SearchInstagramAudioInput!){ searchInstagramAudio(input:$i){ __typename ... on SearchInstagramAudioSuccess { audio { id title displayArtist duration type } } ... on ChannelRefreshRequired { message } } }`,
  { i: { audioType: 'music', channelId: CH, query: 'instrumental' } });
const audio = s.data?.searchInstagramAudio?.audio?.[0];
if (!audio) { console.log('no audio available:', JSON.stringify(s).slice(0, 300)); process.exit(2); }
console.log('track:', audio.title, '-', audio.displayArtist, '| id', audio.id);

const tunnel = await openTunnel((ROOT + '/out/posts/v2-rice'));
await new Promise((r) => setTimeout(r, 3500));
let postId = null;
try {
  const res = await gql(`mutation($i: CreatePostInput!){ createPost(input:$i){ __typename ... on PostActionSuccess { post { id status schedulingType dueAt metadata { __typename ... on InstagramPostMetadata { type } } } } ... on InvalidInputError { message } ... on UnexpectedError { message } ... on LimitReachedError { message } } }`, {
    i: { channelId: CH, text: 'API MUSIC TEST - far future, notification only', assets: ['slide_01.jpg', 'slide_02.jpg'].map((f) => ({ image: { url: tunnel.url(f) } })),
      mode: 'customScheduled', dueAt: '2027-01-15T10:00:00.000Z', schedulingType: 'notification', saveToDraft: false, needsApproval: false, source: 'n8n-studio-test',
      metadata: { instagram: { type: 'post', shouldShareToFeed: true, stickerFields: { music: audio.id } } } } });
  const p = res.data?.createPost;
  console.log('createPost ->', p?.__typename, p?.message || '', res.errors ? JSON.stringify(res.errors).slice(0, 300) : '');
  postId = p?.post?.id;
  if (postId) {
    await new Promise((r) => setTimeout(r, 8000));
    const q = await gql(`query($i: PostInput!){ post(input:$i){ id status metadata { __typename ... on InstagramPostMetadata { type } } } }`, { i: { id: postId } });
    console.log('stored post:', JSON.stringify(q.data?.post), q.errors ? JSON.stringify(q.errors).slice(0, 200) : '');
  }
} finally {
  tunnel.close();
  if (postId) { const d = await gql(`mutation($i: DeletePostInput!){ deletePost(input:$i){ __typename } }`, { i: { id: postId } }); console.log('deleted test post ->', d.data?.deletePost?.__typename); }
  const left = await gql(`query($i: PostsInput!){ posts(first: 20, input:$i){ edges { node { text } } } }`, { i: { organizationId: ORG, filter: { channelIds: [CH], status: ['scheduled', 'draft'] } } });
  console.log('leftover MUSIC TEST posts:', (left.data?.posts?.edges || []).filter((e) => /MUSIC TEST/.test(e.node.text || '')).length);
}
