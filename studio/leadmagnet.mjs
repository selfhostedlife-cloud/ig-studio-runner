// Renders a lead-magnet checklist (spec from agents.writeLeadMagnet) to an A4 PDF.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const { chromium } = await import(pathToFileURL(path.join(here, '..', 'renderer', 'node_modules', 'playwright', 'index.mjs')).href);
const brand = JSON.parse(fs.readFileSync(path.join(here, '..', 'brand', 'brand.json'), 'utf8'));
const c = brand.colors;
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export async function renderLeadMagnet(spec, outPdf, previewPng) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=Inter:wght@400;600;800&display=swap');
@page{size:A4;margin:0}*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Inter,sans-serif;color:#10162b;width:210mm}
.head{background:${c.ink};color:#fff;padding:16mm 16mm 12mm;border-bottom:5px solid ${c.gold}}
.head .tag{display:inline-block;background:${c.gold};color:${c.ink};font-weight:800;letter-spacing:.14em;font-size:9pt;padding:2mm 3.5mm;border-radius:2mm;text-transform:uppercase}
h1{font-family:'Archivo Black';font-size:27pt;line-height:1.08;margin-top:5mm}
.sub{color:#c9d1e4;font-size:12pt;margin-top:3mm}
.body{padding:10mm 16mm}
.sec{margin-bottom:8mm;break-inside:avoid}
h2{font-family:'Archivo Black';font-size:14pt;color:${c.navy};border-left:2.2mm solid ${c.gold};padding-left:3mm;margin-bottom:3mm}
.txt{font-size:11pt;line-height:1.45;color:#2a3350;margin:2mm 0 3mm}.tpl{background:#f3f5fb;border-left:2mm solid #F5B82E;padding:3mm 4mm;font-size:10.5pt;line-height:1.45;white-space:pre-wrap;margin:2mm 0}
.it{display:flex;gap:3mm;font-size:11.5pt;line-height:1.35;margin:2.2mm 0}
.box{flex:0 0 4.2mm;height:4.2mm;border:1.4px solid ${c.navy};border-radius:1mm;margin-top:1mm}
.foot{padding:6mm 16mm;font-size:11pt;color:${c.navy};font-weight:800;border-top:1px solid #dde3f0}
</style></head><body>
<div class="head"><span class="tag">Free checklist</span><h1>${esc(spec.title)}</h1><div class="sub">${esc(spec.subtitle || '')}</div></div>
<div class="body">${(spec.sections || []).map((s) => `<div class="sec"><h2>${esc(s.heading)}</h2>${s.paragraph ? `<div class="txt">${esc(s.paragraph)}</div>` : ''}${s.template ? `<div class="tpl">${esc(s.template)}</div>` : ''}${(s.items || []).map((i) => `<div class="it"><div class="box"></div><div>${esc(i)}</div></div>`).join('')}</div>`).join('')}</div>
<div class="foot">${esc(spec.closing || brand.handle)} &nbsp;|&nbsp; ${esc(brand.handle)}</div>
</body></html>`;
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  if (previewPng) { await page.setViewportSize({ width: 794, height: 1123 }); await page.screenshot({ path: previewPng, clip: { x: 0, y: 0, width: 794, height: 1123 } }); }
  await page.pdf({ path: outPdf, format: 'A4', printBackground: true });
  await browser.close();
  return outPdf;
}
