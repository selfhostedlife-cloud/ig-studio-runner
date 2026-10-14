const ROOT = process.env.IG_ROOT || 'C:/Users/smfab/ig-automation';
// Attaches an Instagram music track to a SCHEDULED Buffer post (re-sends its existing assets + type; changes nothing else).
// Usage: node buffer-set-music.mjs <postId> <audioId>
import fs from 'node:fs';
const KEY = fs.readFileSync((ROOT + '/.env'), 'utf8').match(/^BUFFER_API_KEY=(.*)$/m)[1].trim();
const gql = async (query, variables) => (await (await fetch('https://api.buffer.com', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` }, body: JSON.stringify({ query, variables }) })).json());
const [id, audioId] = process.argv.slice(2);

const cur = await gql(`query($i: PostInput!){ post(input:$i){ id status dueAt channelId text assets { source } metadata { ... on InstagramPostMetadata { type shouldShareToFeed firstComment } } } }`, { i: { id } });
const p0 = cur.data?.post;
if (!p0 || p0.status !== 'scheduled') { console.log('post not found or not scheduled:', JSON.stringify(cur).slice(0, 200)); process.exit(1); }
const a = await gql(`query($i: InstagramAudioInput!){ instagramAudio(input:$i){ id title displayArtist type } }`, { i: { audioId, channelId: p0.channelId } });
console.log('audio check on this channel:', JSON.stringify(a.data?.instagramAudio) || JSON.stringify(a.errors).slice(0, 160));
console.log('before: due', p0.dueAt, '| assets', p0.assets.length);

const r = await gql(`mutation($i: EditPostInput!){ editPost(input:$i){ __typename ... on PostActionSuccess { post { id status dueAt schedulingType assets { source } text } } ... on InvalidInputError { message } ... on UnexpectedError { message } } }`, {
  i: { id, text: p0.text, assets: p0.assets.map((x) => ({ image: { url: x.source } })),
    metadata: { instagram: { type: p0.metadata?.type || 'post', shouldShareToFeed: p0.metadata?.shouldShareToFeed ?? true, ...(p0.metadata?.firstComment ? { firstComment: p0.metadata.firstComment } : {}), stickerFields: { music: audioId } } } } });
const e = r.data?.editPost;
console.log('editPost ->', e?.__typename, e?.message || '', r.errors ? JSON.stringify(r.errors).slice(0, 300) : '');
if (e?.post) {
  console.log('after: status', e.post.status, '| due', e.post.dueAt, '| assets', e.post.assets.length, '| same assets:', JSON.stringify(e.post.assets.map((x) => x.source)) === JSON.stringify(p0.assets.map((x) => x.source)), '| text unchanged:', e.post.text === p0.text);
  const t = await gql('{ __type(name:"InstagramPostMetadata"){ fields { name type { name kind ofType { name } } } } }');
  const sf = t.data.__type.fields.find((f) => f.name === 'stickerFields');
  const sfName = sf.type.name || sf.type.ofType?.name;
  const sft = await gql(`{ __type(name:"${sfName}"){ fields { name } } }`);
  const fields = (sft.data.__type?.fields || []).map((f) => f.name);
  const back = await gql(`query($i: PostInput!){ post(input:$i){ metadata { ... on InstagramPostMetadata { stickerFields { ${fields.includes('music') ? 'music' : fields[0] || '__typename'} } } } } }`, { i: { id } });
  console.log('stored stickerFields:', JSON.stringify(back.data?.post?.metadata?.stickerFields), back.errors ? JSON.stringify(back.errors).slice(0, 200) : '');
}
