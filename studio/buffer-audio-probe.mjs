const ROOT = process.env.IG_ROOT || 'C:/Users/smfab/ig-automation';
// READ-ONLY: which Instagram audio can Buffer attach for each channel?
import fs from 'node:fs';
const KEY = fs.readFileSync((ROOT + '/.env'), 'utf8').match(/^BUFFER_API_KEY=(.*)$/m)[1].trim();
const gql = async (query, variables) => (await (await fetch('https://api.buffer.com', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` }, body: JSON.stringify({ query, variables }) })).json());
const CH = { test: '6ac275fa6a5c39ccb6114033', main: '6ac3579d6a5c39ccb61c8bad' };
for (const [name, channelId] of Object.entries(CH)) for (const audioType of ['music', 'originalSound']) {
  const r = await gql(`query($i: SearchInstagramAudioInput!){ searchInstagramAudio(input:$i){ __typename ... on SearchInstagramAudioSuccess { audio { id title displayArtist duration type } } ... on ChannelRefreshRequired { message channelIds } } }`, { i: { audioType, channelId, query: 'motivation' } });
  if (r.errors) { console.log(`${name} | ${audioType} | ERROR ${JSON.stringify(r.errors).slice(0, 200)}`); continue; }
  const p = r.data.searchInstagramAudio;
  if (p.__typename === 'ChannelRefreshRequired') console.log(`${name} | ${audioType} | REFRESH REQUIRED: ${p.message}`);
  else console.log(`${name} | ${audioType} | ${p.audio.length} results${p.audio[0] ? ' e.g. ' + p.audio.slice(0, 2).map((a) => `"${a.title}" (${a.displayArtist || a.creatorUsername || '?'}, ${a.duration}s)`).join('; ') : ''}`);
}
