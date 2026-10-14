const ROOT = process.env.IG_ROOT || 'C:/Users/smfab/ig-automation';
// Edits the TEXT of a scheduled Buffer post, re-sending its existing (Buffer-hosted) assets + IG type unchanged.
// Usage: node buffer-edit-text.mjs <postId> <captionFile>
import fs from 'node:fs';
const KEY = fs.readFileSync((ROOT + '/.env'), 'utf8').match(/^BUFFER_API_KEY=(.*)$/m)[1].trim();
const gql = async (query, variables) => (await (await fetch('https://api.buffer.com', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` }, body: JSON.stringify({ query, variables }) })).json());
const [id, file] = process.argv.slice(2);
const text = fs.readFileSync(file, 'utf8').trim();

const cur = await gql(`query($i: PostInput!){ post(input:$i){ id status dueAt schedulingType shareMode assets { source type } metadata { ... on InstagramPostMetadata { type shouldShareToFeed } } } }`, { i: { id } });
const p0 = cur.data?.post;
if (!p0) { console.log('cannot read post', JSON.stringify(cur.errors || cur).slice(0, 300)); process.exit(1); }
console.log('before: status', p0.status, '| due', p0.dueAt, '| assets', p0.assets.length, '| type', p0.metadata?.type);

const input = {
  id, text,
  assets: p0.assets.map((a) => ({ image: { url: a.source } })),
  metadata: { instagram: { type: p0.metadata?.type || 'post', shouldShareToFeed: p0.metadata?.shouldShareToFeed ?? true } },
};
const r = await gql(`mutation($i: EditPostInput!){ editPost(input:$i){ __typename ... on PostActionSuccess { post { id status dueAt schedulingType shareMode text assets { source } } } ... on InvalidInputError { message } ... on NotFoundError { message } ... on UnexpectedError { message } } }`, { i: input });
if (r.errors) { console.log('errors:', JSON.stringify(r.errors).slice(0, 400)); process.exit(1); }
const p = r.data.editPost;
console.log('editPost ->', p.__typename, p.message || '');
if (p.post) {
  console.log('after: status', p.post.status, '| due', p.post.dueAt, '| schedulingType', p.post.schedulingType, '| mode', p.post.shareMode, '| assets', p.post.assets.length);
  console.log('assets same order+urls:', JSON.stringify(p.post.assets.map((a) => a.source)) === JSON.stringify(p0.assets.map((a) => a.source)));
  console.log('text now:\n' + p.post.text);
}
