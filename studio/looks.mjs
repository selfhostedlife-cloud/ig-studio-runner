// Design rotation. Owner rule (2026-10-13): the stock photo behind the subject stays on almost every post (it makes the post feel connected to what it talks about);
// what rotates is colour, font and headline style OVER the photo. A few text-only looks (no photo) run only as occasional tests (about 1 post in 5),
// so the learning loop can compare them (feature `look=`).
//   node looks.mjs list | pick | apply <postDir> [name]
// Photo looks write spec.photoTheme (render.mjs restyles tag, highlights, overlay tint, headline font/case) and re-render with --keep-photos (same photos, no Gemini).
// Text-only looks go through mimic.mjs. spec.pre-look.json keeps the unstyled spec so any look can be swapped later.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(here, 'data');
const rd = (f, d) => { try { return JSON.parse(fs.readFileSync(path.join(dataDir, f), 'utf8')); } catch { return d; } };

export const LOOKS = {
  // ---- photo looks: stock photo background, different colours / fonts / headline style ----
  'ink-gold': { photo: true, label: 'Navy overlay, gold highlights, Archivo Black (the original)', theme: null },
  'saffron-photo': { photo: true, label: 'Warm dark-brown overlay, saffron highlights, tall Anton capitals', theme: { ink: '#1A0B00', accent: '#FF9F1C', accent2: '#C2410C', tagText: '#1A0B00', font: 'Anton', upper: true } },
  'royal-photo': { photo: true, label: 'Deep purple overlay, yellow highlights, Archivo Black', theme: { ink: '#140A33', accent: '#FFD23F', accent2: '#7C3AED', tagText: '#140A33', font: 'Archivo Black' } },
  'emerald-photo': { photo: true, label: 'Deep green overlay, mint highlights, Rubik', theme: { ink: '#04201A', accent: '#34F5B0', accent2: '#0F766E', tagText: '#04201A', font: 'Rubik' } },
  'crimson-photo': { photo: true, label: 'Dark red overlay, red highlights, condensed Bebas Neue capitals', theme: { ink: '#1A0508', accent: '#FF4D5E', accent2: '#B91C1C', tagText: '#FFFFFF', font: 'Bebas Neue', upper: true } },
  'ocean-photo': { photo: true, label: 'Deep teal overlay, aqua highlights, Fraunces serif', theme: { ink: '#04202E', accent: '#5CE1E6', accent2: '#1D4ED8', tagText: '#04202E', font: 'Fraunces' } },
  'serif-gold-photo': { photo: true, label: 'Navy overlay, gold highlights, DM Serif Display headlines', theme: { ink: '#0A0F1E', accent: '#F5B82E', accent2: '#7C3AED', tagText: '#0A0F1E', font: 'DM Serif Display' } },
  // ---- text-only test looks (no photo): used about 1 post in 5 to see whether they pull more or less ----
  'cream-serif': { photo: false, label: 'TEST no photo: cream paper, serif headlines, red highlight', design: { typographic: true, palette: { bg: '#FFF3DC', fg: '#1A1A2E', accent: '#C1121F', accent2: '#1A1A2E' }, font_guess: 'DM Serif Display' } },
  'saffron-punch': { photo: false, label: 'TEST no photo: saffron background, black text, navy highlight', design: { typographic: true, palette: { bg: '#FF9F1C', fg: '#111111', accent: '#0B2A5B', accent2: '#7B2CBF' }, font_guess: 'Anton' } },
  'mint-fresh': { photo: false, label: 'TEST no photo: light mint, deep green text', design: { typographic: true, palette: { bg: '#E6F7EE', fg: '#0B2B22', accent: '#0F9D58', accent2: '#0B2B22' }, font_guess: 'Rubik' } },
  'red-news': { photo: false, label: 'TEST no photo: white page, black text, red highlight, Bebas Neue', design: { typographic: true, palette: { bg: '#FFFFFF', fg: '#111111', accent: '#E63946', accent2: '#111111' }, font_guess: 'Bebas Neue' } },
};
const PHOTO = Object.keys(LOOKS).filter((k) => LOOKS[k].photo), TEXTONLY = Object.keys(LOOKS).filter((k) => !LOOKS[k].photo);

// the look a post wears: its own tag (old text-only names that no longer exist count as text-only tests), else the original look
export const lookOf = (p) => p.look || (p.kind === 'reference' ? 'reference' : p.kind === 'data' ? 'data' : 'ink-gold');

// rotation: a photo look that is not one of the last 3 used (least recently used first); a text-only test only when none of the last 4 posts was text-only
export function pickLook(posts = rd('state.json', { posts: [] }).posts) {
  const live = posts.filter((p) => p.status !== 'rejected');
  const recent = live.slice(-4).map(lookOf);
  const lastUse = {}; live.forEach((p, i) => { lastUse[lookOf(p)] = i; });
  const lru = (pool) => { const s = [...pool].sort((a, b) => (lastUse[a] ?? -1) - (lastUse[b] ?? -1)); const best = s.filter((k) => (lastUse[k] ?? -1) === (lastUse[s[0]] ?? -1)); return best[Math.floor(Math.random() * best.length)]; };
  // a text-only test is due after 4 posts without one (the recent text-only posts, if any, counted from the end)
  const lastText = Math.max(-1, ...live.map((p, i) => (LOOKS[lookOf(p)] && !LOOKS[lookOf(p)].photo ? i : -1)));
  if (live.length - 1 - lastText >= 4) return lru(TEXTONLY);
  const pool = PHOTO.filter((k) => !recent.slice(-3).includes(k));
  return lru(pool.length ? pool : PHOTO);
}

export function applyLook(dir, name) {
  const look = LOOKS[name]; if (!look) throw new Error('unknown look ' + name + ' (try: ' + Object.keys(LOOKS).join(', ') + ')');
  const pre = path.join(dir, 'spec.pre-look.json');
  if (!fs.existsSync(pre)) fs.copyFileSync(path.join(dir, 'spec.json'), pre);
  const spec = JSON.parse(fs.readFileSync(pre, 'utf8')); // always start from the unstyled version
  delete spec.photoTheme;
  if (look.photo) {
    if (look.theme) { spec.photoTheme = look.theme; spec.font = look.theme.font; }
    fs.writeFileSync(path.join(dir, 'spec.json'), JSON.stringify(spec, null, 2));
    const r = spawnSync(process.execPath, [path.join(here, '..', 'renderer', 'render.mjs'), path.join(dir, 'spec.json'), dir, '--keep-photos'], { encoding: 'utf8', timeout: 10 * 60e3 });
    if (r.status !== 0) throw new Error('look failed: ' + (r.stderr || '').slice(-300));
    return name;
  }
  fs.writeFileSync(path.join(dir, 'spec.json'), JSON.stringify(spec, null, 2));
  const styleFile = path.join(dir, 'look-style.json');
  fs.writeFileSync(styleFile, JSON.stringify({ design: look.design }));
  const r = spawnSync(process.execPath, [path.join(here, 'mimic.mjs'), dir, styleFile], { encoding: 'utf8', timeout: 10 * 60e3 });
  if (r.status !== 0) throw new Error('look failed: ' + (r.stderr || '').slice(-300));
  return name;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const [cmd, dir, name] = process.argv.slice(2);
  if (cmd === 'list') for (const [k, v] of Object.entries(LOOKS)) console.log(k.padEnd(17), v.label);
  else if (cmd === 'pick') console.log(pickLook());
  else if (cmd === 'apply' && dir) { const n = name || pickLook(); console.log(JSON.stringify({ look: applyLook(dir, n) })); }
  else console.log('usage: node looks.mjs list | pick | apply <postDir> [name]');
}
