const ROOT = process.env.IG_ROOT || 'C:/Users/smfab/ig-automation';
// Builds revised (v2) copies of the rice + Germany carousels with the owner's design edits. Originals stay untouched.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { renderLeadMagnet } from './leadmagnet.mjs';

const posts = (ROOT + '/out/posts/');
const rd = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const wr = (p, o) => fs.writeFileSync(p, typeof o === 'string' ? o : JSON.stringify(o, null, 2));

// 1) renderer: support an exact Pixabay photo via slide.imageId
{
  const f = (ROOT + '/renderer/render.mjs');
  let s = fs.readFileSync(f, 'utf8');
  if (!s.includes('getPhotoById')) {
    s = s.replace('async function getPhoto(', `async function getPhotoById(id, file) {
  if (fs.existsSync(file)) return file;
  const r = await fetch('https://pixabay.com/api/?' + new URLSearchParams({ key: PIX_KEY, id: String(id) }));
  const hit = (await r.json()).hits?.[0];
  if (!hit) throw new Error('Pixabay id not found: ' + id);
  usedIds.add(hit.id);
  fs.writeFileSync(file, Buffer.from(await (await fetch(hit.largeImageURL)).arrayBuffer()));
  fs.writeFileSync(file + '.credit.json', JSON.stringify({ source: 'Pixabay', id: hit.id, author: hit.user, page: hit.pageURL, tags: hit.tags, license: 'Pixabay License' }));
  return file;
}
async function getPhoto(`);
    s = s.replace(/const q = s\.imageQueries \|\| s\.imageQuery \|\| s\.imagePrompt; if \(q\) imgFile = await getPhoto\(/, "const q = s.imageQueries || s.imageQuery || s.imagePrompt; const fileN = path.join(outDir, `img_${String(i + 1).padStart(2, '0')}.jpg`); if (s.imageId) imgFile = await getPhotoById(s.imageId, fileN); else if (q) imgFile = await getPhoto(");
    fs.writeFileSync(f, s);
  }
  console.log('renderer imageId support:', s.includes('getPhotoById(s.imageId'));
}

function make(srcName, dstName, edit) {
  const src = posts + srcName + '/', dst = posts + dstName + '/';
  fs.rmSync(dst, { recursive: true, force: true });
  fs.mkdirSync(dst, { recursive: true });
  for (const f of fs.readdirSync(src)) if (/^img_\d+\.jpg(\.credit\.json)?$|\.pdf$|^leadmagnet\.json$|^review\.json$/.test(f)) fs.copyFileSync(src + f, dst + f);
  const spec = rd(src + 'spec.json');
  const cap = fs.readFileSync(src + 'caption.txt', 'utf8');
  const out = edit(spec, cap, dst);
  wr(dst + 'spec.json', spec);
  wr(dst + 'caption.txt', out.caption);
  return dst;
}

const HASH = (arr) => '\n\n' + arr.join(' ');

// ================= RICE v2 =================
const riceDst = make('2026-10-04-c1-rice-exporter-payment-risk-lc-', 'v2-rice', (spec, cap, dst) => {
  const S = spec.slides;
  S[0].title = '==₹45 lakh== of basmati shipped on 10% advance.\n++The buyer refused to pay.++';
  S[0].sub = 'Here is what protects you before you ship.';
  S[1].title = 'Why ++DP terms++ left him exposed';
  S[1].text = 'He shipped 3 containers on 10% advance, balance on DP.\nThe buyer refused to take the documents.\nThe goods sat at the port.';
  S[2].title = 'Mistake vs ==Fix==';
  S[2].imageQueries = ['calculator money desk', 'coins stack growth']; for (const f of ['img_03.jpg', 'img_03.jpg.credit.json']) fs.rmSync(dst + f, { force: true });
  S[2].text = '!!Mistake:!!\nShipping on DP with no buyer check and no cover.\n\n++Fix:++\nRun a buyer credit check and get ECGC cover.\nConfirm current terms at ecgc.in.';
  S[3].title = 'Three ++LC checks++ before you ship';
  S[3].items = ["Ask for a ==confirmed LC== if the buyer's bank or country is risky", 'Match goods description and ==shipment date== to your contract', 'Check LC ==expiry== and presentation period before production'];
  S[4].title = 'The ==30-70== structure';
  S[4].imageQueries = ['cargo ship ocean', 'shipping containers stacked']; for (const f of ['img_05.jpg', 'img_05.jpg.credit.json']) fs.rmSync(dst + f, { force: true });
  S[4].text = 'Ask for ++30% advance++ before production.\nAsk for ++70% by LC at sight++.\nA buyer refusing both needs a closer check.';
  S[5].title = 'Send documents ++through your bank++';
  S[5].text = 'Never hand original documents straight to the buyer.\nRoute them through your bank so they are released only against ==payment or acceptance==.';
  S[6] = { type: 'cta', kicker: 'Free PDF', title: 'Get the ==Secure Payment Checklist==', button: 'Comment  RICE', text: 'Inside:\nLC check clauses\nPayment-terms decision list\nECGC steps', pdfPreview: 'pdf_preview.png', imageQueries: ['cargo containers sunset', 'port cranes containers'] };
  for (const f of ['img_07.jpg', 'img_07.jpg.credit.json']) fs.rmSync(dst + f, { force: true });
  const hashtags = cap.split('\n').filter((l) => l.startsWith('#')).pop();
  return { caption: '₹45 lakh of basmati shipped on 10% advance. The buyer refused to pay.\n\n(Example scenario based on common export payment problems.)\n\nShipping on weak payment terms puts your whole container at risk. Swipe for the 3 LC checks, the 30-70 structure and how ECGC cover fits in.\n\nComment RICE and I\'ll DM you the Secure Payment Terms & LC Checklist. Follow so the DM reaches you.' + HASH([hashtags]) };
});

// ================= GERMANY v2 =================
const deDst = make('2026-10-04-c2-finding-handloom-textile-buyer', 'v2-germany', (spec, cap, dst) => {
  const S = spec.slides;
  S[0].title = 'He sent ==500 cold emails== to Germany.\n++Zero replies.++';
  S[0].sub = 'Here is what German buyers check before they answer.';
  S[0].imageId = 5700049; delete S[0].imageQueries;
  for (const f of ['img_01.jpg', 'img_01.jpg.credit.json']) fs.rmSync(dst + f, { force: true });
  S[1].title = 'Stop sending ++generic emails++';
  S[1].imageId = 5243227; delete S[1].imageQueries; for (const f of ['img_02.jpg', 'img_02.jpg.credit.json']) fs.rmSync(dst + f, { force: true });
  S[1].text = '!!Mistake:!!\nSpamming info@ inboxes.\n\n++Fix:++\nTarget procurement managers via Europages.\nCheck their sourcing needs first.';
  S[2].title = 'Where German buyers search:\n==wlw.de== & ==Europages==';
  S[2].text = 'Start with these two B2B directories.\nFilter by product and country.\nShortlist firms that already import or distribute home textiles.';
  S[3].title = 'Expect to be asked for ++OEKO-TEX / GOTS++';
  S[3].imageQueries = ['textile factory', 'factory production line']; for (const f of ['img_04.jpg', 'img_04.jpg.credit.json']) fs.rmSync(dst + f, { force: true });
  S[3].text = 'Many German buyers ask for OEKO-TEX Standard 100 or GOTS certificates.\nLarge firms also check suppliers\' social and environmental risks (LkSG).\nVerify current rules at bafa.bund.de.';
  S[4].title = 'Use ==precise specs== in your pitch';
  S[4].text = 'Instead of "high quality", write:\n"Our GOTS-certified organic cotton towels have under 4% shrinkage and 400 GSM density."';
  S[5].title = 'Write the ++one email++ that gets read';
  S[5].items = ['Name the ==person== and the product they buy', 'State ==one certificate== and ==two exact specs==', 'Ask for ==one small next step==: catalogue or sample'];
  S[6] = { type: 'cta', kicker: 'Free PDF', title: 'Get the ++Germany Buyer Blueprint++', button: 'Comment GERMANY', text: 'Inside:\n3 cold email templates\n5 places to find German buyers\nCompliance checklist', pdfPreview: 'pdf_preview.png', imageQueries: ['cargo containers sunset', 'harbor sea ship'] };
  for (const f of ['img_07.jpg', 'img_07.jpg.credit.json']) fs.rmSync(dst + f, { force: true });
  const hashtags = cap.split('\n').filter((l) => l.startsWith('#')).pop();
  return { caption: 'He sent 500 cold emails to Germany. Zero replies.\n\n(Example scenario based on common export outreach problems.)\n\nSwipe to see where German buyers search (wlw.de, Europages), what certificates they commonly ask for, and what a first email should say instead of "best quality".\n\nComment GERMANY and I\'ll DM you the Germany Buyer Research Blueprint. Follow so the DM reaches you.' + HASH([hashtags]) };
});

// PDF first-page previews (rendered from the same lead-magnet content, so the card shows the real PDF)
for (const dst of [riceDst, deDst]) {
  const lm = rd(dst + 'leadmagnet.json');
  const pdf = fs.readdirSync(dst).find((f) => f.endsWith('.pdf'));
  await renderLeadMagnet(lm, dst + pdf, dst + 'pdf_preview.png');
}

for (const dst of [riceDst, deDst]) {
  fs.readdirSync(dst).filter((f) => /^slide_\d+\.jpg$/.test(f)).forEach((f) => fs.rmSync(dst + f));
  const r = spawnSync(process.execPath, [(ROOT + '/renderer/render.mjs'), dst + 'spec.json', dst], { encoding: 'utf8' });
  console.log(dst, r.status === 0 ? 'rendered' : 'FAILED ' + r.stderr.slice(0, 300));
}
