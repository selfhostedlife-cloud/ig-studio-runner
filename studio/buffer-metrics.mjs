const ROOT = process.env.IG_ROOT || 'C:/Users/smfab/ig-automation';
import fs from 'node:fs';
const KEY = fs.readFileSync((ROOT + '/.env'), 'utf8').match(/^BUFFER_API_KEY=(.*)$/m)[1].trim();
const gql = async (query, variables) => (await (await fetch('https://api.buffer.com', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` }, body: JSON.stringify({ query, variables }) })).json());
const ORG = '5ab46e7a0b3b3a6f31ae27a4', CH = '6ac275fa6a5c39ccb6114033';
const end = new Date(), start = new Date(Date.now() - 90 * 864e5);

const agg = await gql(`query($i: AggregatedPostMetricsInput!){ aggregatedPostMetrics(input:$i){ metricsUpdatedAt metrics { name type unit value } } }`,
  { i: { organizationId: ORG, channelIds: [CH], startDateTime: start.toISOString(), endDateTime: end.toISOString() } });
console.log('AGGREGATED (90d):', agg.errors ? JSON.stringify(agg.errors).slice(0, 400) : JSON.stringify(agg.data.aggregatedPostMetrics).slice(0, 900));

const posts = await gql(`query($i: PostsInput!){ posts(first: 10, input:$i){ edges { node { id status sentAt text metricsUpdatedAt metrics { type value unit } } } } }`,
  { i: { organizationId: ORG, filter: { channelIds: [CH], status: ['sent'] } } });
if (posts.errors) console.log('posts error:', JSON.stringify(posts.errors).slice(0, 400));
else {
  const nodes = posts.data.posts.edges.map((e) => e.node);
  console.log('SENT posts visible via Buffer:', nodes.length);
  nodes.slice(0, 3).forEach((n) => console.log('-', n.sentAt, JSON.stringify((n.text || '').slice(0, 40)), '| metrics:', JSON.stringify(n.metrics || []).slice(0, 260)));
}
