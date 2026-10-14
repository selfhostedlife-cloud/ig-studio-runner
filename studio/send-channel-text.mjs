const ROOT = process.env.IG_ROOT || 'C:/Users/smfab/ig-automation';
// Sends the WhatsApp-channel copy/paste text for given post numbers to the owner's Telegram. Usage: node send-channel-text.mjs 8 9
import fs from 'node:fs';
import path from 'node:path';
import * as tg from './telegram.mjs';
const dir = (ROOT + '/studio/data');
const state = JSON.parse(fs.readFileSync(path.join(dir, 'state.json'), 'utf8'));
const magnets = JSON.parse(fs.readFileSync(path.join(dir, 'leadmagnets.json'), 'utf8')).magnets;
for (const no of process.argv.slice(2).map(Number)) {
  const p = state.posts.find((x) => x.no === no);
  if (!p) { console.log('no post', no); continue; }
  let title = p.topic;
  try { title = JSON.parse(fs.readFileSync(path.join(p.dir, 'leadmagnet.json'), 'utf8')).title || title; } catch { /* keep */ }
  const link = magnets[p.keyword]?.viewLink;
  if (!link) { console.log('no Drive link for', p.keyword); continue; }
  const text = ['FREE GUIDE: ' + title, '', p.hook, '', 'Download here: ' + link, '(Comment ' + p.keyword + ' on the Instagram post to get it by DM too.)'].join('\n');
  await tg.sendMessage(state.chatId, `WhatsApp channel post for #${no} (paste when the Instagram post is live):\n\n${text}`);
  console.log('sent #' + no, p.keyword);
}
