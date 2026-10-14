const ROOT = process.env.IG_ROOT || 'C:/Users/smfab/ig-automation';
// READ-ONLY: trending Instagram music available to a channel. Usage: node buffer-trending-audio.mjs [test|main]
import fs from 'node:fs';
const KEY = fs.readFileSync((ROOT + '/.env'), 'utf8').match(/^BUFFER_API_KEY=(.*)$/m)[1].trim();
const gql = async (query, variables) => (await (await fetch('https://api.buffer.com', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` }, body: JSON.stringify({ query, variables }) })).json());
const CH = { test: '6ac275fa6a5c39ccb6114033', main: '6ac3579d6a5c39ccb61c8bad' }[process.argv[2] || 'test'];
const r = await gql(`query($i: TrendingInstagramAudioInput!){ trendingInstagramAudio(input:$i){ __typename ... on SearchInstagramAudioSuccess { audio { id title displayArtist duration type } } ... on ChannelRefreshRequired { message } } }`, { i: { audioType: 'music', channelId: CH } });
const p = r.data?.trendingInstagramAudio;
if (!p || p.__typename !== 'SearchInstagramAudioSuccess') { console.log(JSON.stringify(r).slice(0, 300)); process.exit(1); }
p.audio.forEach((a, i) => console.log(`${String(i + 1).padStart(2)}. ${a.title} | ${a.displayArtist || '?'} | ${Math.round(a.duration / (a.duration > 1000 ? 1000 : 1))}s | id ${a.id}`));
