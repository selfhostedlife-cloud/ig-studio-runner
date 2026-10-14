const ROOT = process.env.IG_ROOT || 'C:/Users/smfab/ig-automation';
// Sends a folder's slide_*.jpg as a Telegram album to the paired chat. Usage: node send-album.mjs <dir> "<caption>"
import fs from 'node:fs';
import path from 'node:path';
import * as tg from './telegram.mjs';
const [dir, caption] = process.argv.slice(2);
const chat = JSON.parse(fs.readFileSync((ROOT + '/studio/data/state.json'), 'utf8')).chatId;
const files = fs.readdirSync(dir).filter((f) => /^slide_\d+\.jpg$/.test(f)).sort().map((f) => path.join(dir, f));
await tg.sendAlbum(chat, files, caption);
const pdf = fs.readdirSync(dir).find((f) => f.endsWith('.pdf'));
if (pdf) await tg.sendDocument(chat, path.join(dir, pdf), 'Lead-magnet PDF for this post');
console.log('sent', files.length, 'slides', pdf ? '+ PDF' : '');
