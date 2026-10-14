const ROOT = process.env.IG_ROOT || 'C:/Users/smfab/ig-automation';
// Builds out/review/<postFolder>.jpg: a contact sheet of all slides (for visual QA). Usage: node contact-sheet.mjs <postDir>...
import fs from 'node:fs';
import path from 'node:path';
const { chromium } = await import('file:///C:/Users/smfab/ig-automation/renderer/node_modules/playwright/index.mjs');
fs.mkdirSync((ROOT + '/out/review'), { recursive: true });
const b = await chromium.launch();
for (const dir of process.argv.slice(2)) {
  const slides = fs.readdirSync(dir).filter((f) => /^slide_\d+\.jpg$/.test(f)).sort();
  const cols = 4, w = 400;
  const html = `<body style="margin:0;background:#222;display:grid;grid-template-columns:repeat(${cols},${w}px);gap:6px">` + slides.map((f) => `<img width="${w}" height="${w}" src="file:///${path.resolve(dir, f).split(path.sep).join('/')}">`).join('') + '</body>';
  const p = await b.newPage({ viewport: { width: cols * w + (cols - 1) * 6, height: Math.ceil(slides.length / cols) * (w + 6) } });
  const hf = (ROOT + '/out/review/_sheet.html'); fs.writeFileSync(hf, html); await p.goto('file:///' + hf); await p.waitForTimeout(800);
  await p.screenshot({ path: `C:/Users/smfab/ig-automation/out/review/${path.basename(dir)}.jpg`, type: 'jpeg', quality: 80 });
  await p.close();
}
await b.close();
