// Reference post -> new post. The owner sends slides (screenshots) of a post that went viral (a competitor's, for example) through Telegram.
//  1. Gemini vision reads the slides: hook pattern, slide-by-slide structure, caption style, CTA type, palette, font, typographic-or-photo look.
//  2. A concept is written that keeps the winning STRUCTURE but is original: fresh wording, our audience's angle, one better tweak, our own lead magnet.
//  3. make-from-concept.mjs builds slides + caption + PDF with that structure (slide count follows the reference, 5-10).
//  4. mimic.mjs applies the reference's palette/font/typographic look.
// Nothing from the competitor is reused: no images, no wording, no brand names; only the pattern. Usage: node reference.mjs <jobDir>
//   jobDir/meta.json = { files:[ordered image paths], note, caption, url }
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { gemini } from './agents.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const job = process.argv[2];
const meta = JSON.parse(fs.readFileSync(path.join(job, 'meta.json'), 'utf8'));
const log = (...a) => console.error('[reference]', ...a);
const rd = (f, d) => { try { return JSON.parse(fs.readFileSync(path.join(here, 'data', f), 'utf8')); } catch { return d; } };

const files = (meta.files || []).slice(0, 10);
if (!files.length) { console.error('no reference images'); process.exit(2); }
const images = files.map((f) => ({ mime: /\.png$/i.test(f) ? 'image/png' : 'image/jpeg', data: fs.readFileSync(f).toString('base64') }));

log('reading', files.length, 'slides with vision...');
const analysis = await gemini(`You are a social-media strategist. These ${files.length} images are the slides, in order, of an Instagram carousel that the owner of an Indian import-export education account saw performing very well. ${meta.caption ? 'Its caption: ' + JSON.stringify(meta.caption) : ''} ${meta.note ? 'Owner note: ' + JSON.stringify(meta.note) : ''}
Analyse WHY it works and describe it precisely so a team can build a similar-but-original post. Return JSON:
{"topic":"what it is about","slide_count":${files.length},"hook_text":"cover text as written","hook_pattern":"the pattern (e.g. money loss with exact number, myth-breaker, how-to for named market)","structure":[{"slide":1,"role":"hook|tension|step|proof|payoff|cta","summary":"what this slide says in 1 line","words":"approx word count","visual":"layout/visual note"}],"caption_style":{"length":"short|medium|long","opening":"how it opens","cta_type":"comment keyword / follow / save / share","hashtags":0},"cta":{"type":"","keyword":"keyword if any"},"design":{"palette":{"bg":"#RRGGBB dominant background","fg":"#RRGGBB main text","accent":"#RRGGBB highlight colour","accent2":"#RRGGBB secondary"},"theme_guess":"closest of dark|light|gold|purple|amber|monored|mint|cream|lime","font_guess":"closest of Archivo Black|Bebas Neue|DM Serif Display|Anton|Rubik|Fraunces|Inter","typographic":true/false (true when slides are mostly big text on flat colour, false when full-bleed photos),"cover_style":"typographic|photo|mixed","text_density":"low|medium|high","highlight_style":"how keywords are emphasised"},"why_it_works":["..."],"tweak":"ONE specific improvement we should add (a sharper number, a concrete fix, a clearer CTA) without changing the winning structure"}`, { images });
fs.writeFileSync(path.join(job, 'style.json'), JSON.stringify(analysis, null, 2));
log('pattern:', analysis.hook_pattern, '| slides:', analysis.slide_count);

log('writing our concept...');
const used = (rd('state.json', { posts: [] }).posts || []).map((p) => String(p.keyword || '').toUpperCase());
const live = rd('playbook-live.json', null);
const out = await gemini(`Write ONE original carousel concept for @faizanali.shahji (audience: first-time and small Indian exporters/importers) that reuses the WINNING STRUCTURE of this reference analysis but none of its wording, imagery or brand names. The subject may be the same as the reference (the audience clearly cares) but our angle must be ours, practical, specific (named product/country/document/scheme) and verifiable. Apply the tweak.
REFERENCE ANALYSIS: ${JSON.stringify(analysis)}
LIVE LEARNINGS FROM OUR OWN RESULTS: ${JSON.stringify(live ? { double_down: live.double_down, hook_rules: live.hook_rules } : null)}
Rules: hook <= 12 words in plain English, following the reference's hook PATTERN; slide_outline must have exactly ${analysis.slide_count || 7} entries mirroring the reference's roles; offer = a lead magnet we can really produce as a 1-3 page PDF (checklist/template/decision sheet), keyword 3-7 letters, NOT one of these already used: ${JSON.stringify(used)}; never promise lists of named buyer contacts; no invented statistics (label examples as illustrative); never state a legal requirement as fact unless certain.
Return JSON: {"concepts":[{"title":"","hook":"","sub":"one line raising the stakes, max 14 words","pain_point":"","why_it_works_here":"","slide_outline":["slide 1: ..."],"offer":{"keyword":"","deliverable":"","format":""},"news_link":"evergreen","format":"","mode":"reference","tests":"${(analysis.tweak || '').replace(/"/g, "'").slice(0, 120)}","fact_risks":"claims to verify"}]}`);
const concept = out.concepts?.[0];
if (!concept) { console.error('no concept produced'); process.exit(3); }
fs.writeFileSync(path.join(job, 'concepts.json'), JSON.stringify({ concepts: [concept] }, null, 2));

log('building the post:', concept.hook);
const r = spawnSync(process.execPath, [path.join(here, 'make-from-concept.mjs'), '1', '--concepts', path.join(job, 'concepts.json'), '--style', path.join(job, 'style.json'), '--hook', concept.hook, '--sub', concept.sub || ''], { encoding: 'utf8', maxBuffer: 50e6, timeout: 25 * 60e3 });
process.stderr.write((r.stderr || '').split('\n').filter((l) => l.startsWith('[studio]')).slice(-12).join('\n') + '\n');
if (r.status !== 0) { console.error('build failed: ' + (r.stderr || '').slice(-300)); process.exit(4); }
const info = JSON.parse(r.stdout.trim().slice(r.stdout.indexOf('{')));

log('applying the reference look...');
const m = spawnSync(process.execPath, [path.join(here, 'mimic.mjs'), info.outDir, path.join(job, 'style.json')], { encoding: 'utf8', timeout: 10 * 60e3 });
let look = {};
try { look = JSON.parse(m.stdout.trim()); } catch { log('look not applied:', (m.stderr || '').slice(-200)); }
console.log(JSON.stringify({ ...info, title: concept.title, hook: concept.hook, sub: concept.sub, pattern: analysis.hook_pattern, tweak: analysis.tweak, why: analysis.why_it_works, look, slideCount: analysis.slide_count }));
