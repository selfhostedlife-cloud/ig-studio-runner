// Regenerates the lead-magnet checklist for an existing post dir, saves its JSON for review, fact-checks, renders PDF.
// Usage: node lm-regen.mjs <postDir> "<title>" "<keyword>"
import fs from 'node:fs';
import path from 'node:path';
import { writeLeadMagnet, factCheck, slugify } from './agents.mjs';
import { renderLeadMagnet } from './leadmagnet.mjs';

const [dir, title, keyword] = process.argv.slice(2);
const spec = JSON.parse(fs.readFileSync(path.join(dir, 'spec.json'), 'utf8'));
const plan = { leadmagnet_title: title, leadmagnet_keyword: keyword };
const lm = await writeLeadMagnet(plan, spec);
fs.writeFileSync(path.join(dir, 'leadmagnet.json'), JSON.stringify(lm, null, 2));
console.log(`# ${lm.title}\n${lm.subtitle || ''}`);
for (const s of lm.sections || []) { console.log(`\n## ${s.heading}`); (s.items || []).forEach((i) => console.log(' [ ]', i)); }
console.log('\nclosing:', lm.closing);

const claims = (lm.sections || []).flatMap((s) => s.items || []);
const fc = await factCheck(claims);
fs.writeFileSync(path.join(dir, 'leadmagnet-factcheck.txt'), fc.raw || '');
console.log('\nFACT-CHECK flagged lines:', fc.issues.length ? '\n' + fc.issues.join('\n') : 'none');

for (const old of fs.readdirSync(dir).filter((f) => f.endsWith('.pdf'))) fs.unlinkSync(path.join(dir, old));
const pdf = path.join(dir, `${slugify(title)}.pdf`);
await renderLeadMagnet(lm, pdf);
console.log('\nPDF:', pdf, fs.statSync(pdf).size, 'bytes');
