// Photo selection helpers (Gemini): suggestQueries = concrete Pixabay search terms per slide; judgePhoto = vision check of candidates.
// judgePhoto returns {best: index | -1, reason}. -1 means "no photo fits" -> the renderer uses a graphic design instead of a wrong photo.
import { gemini } from '../studio/agents.mjs';

const plain = (t) => String(t ?? '').replace(/(==|\+\+|!!|\*\*)/g, '').replace(/\s*\n+\s*/g, ' ').trim();
const slideText = (slide) => [slide.kicker, slide.title, slide.sub, slide.text, slide.stat, ...(slide.items || [])].filter(Boolean).map(plain).join(' | ');

// One text call per post: 3 concrete, visual search queries (objects you can SEE) for each slide that needs a photo.
export async function suggestQueries(slides, topic) {
  const list = slides.map((s, i) => `${i}: ${slideText(s)}`).join('\n');
  const prompt = `For each slide of an Indian import-export Instagram carousel (topic: ${plain(topic)}), give 3 short Pixabay stock-photo search queries (2-4 words each) describing something concrete and VISIBLE that literally illustrates the slide: the commodity, a place, a document, equipment or an action (e.g. "flour mill sacks", "laboratory test tubes", "customs officer inspecting", "container terminal crane", "plant inspection certificate"). No abstract words, no people portraits, no brand names.
Slides:
${list}
Return JSON {"slides":[{"i":0,"q":["...","...","..."]}, ...]} covering every slide index.`;
  const r = await gemini(prompt);
  const out = {};
  for (const x of r?.slides || []) if (Number.isInteger(x.i) && Array.isArray(x.q)) out[x.i] = x.q.map(String).filter(Boolean).slice(0, 3);
  return out;
}

export async function judgePhoto(slide, topic, cands) {
  const prompt = `You choose the background photo for ONE Instagram slide in an Indian import-export education carousel.
Post topic: ${plain(topic)}
Slide text: ${slideText(slide)}
You get ${cands.length} candidate photos, numbered 0 to ${cands.length - 1} in the order given.
Score EVERY candidate 0-10 for how directly it shows what this slide is about:
10 = shows exactly the subject (rice sacks for a rice slide, flour sacks for a flour slide, a lab for a lab-test slide, a port crane for port charges).
7 = clearly relevant scene (e.g. hands with documents for a paperwork slide, containers for a shipping slide).
0-4 = unrelated or only loosely connected.
Always score LOW (0-3) when the photo: shows a close-up face or portrait; shows an unrelated object (tape dispenser, stationery, binder clips, coffee beans, ruins, landscapes, animals, jewellery); shows a different commodity, country or industry than the text names; is blank, blurry or very dark; or only matches a single loose word.
Banknotes score high only for slides about money amounts, payments or currency.
Return JSON {"scores":[<one number per candidate>], "best": <index of highest score or -1 if the highest is below 7>, "reason": "<max 10 words>"}.`;
  const r = await gemini(prompt, { images: cands.map((c) => ({ mime: 'image/jpeg', data: c.thumb.toString('base64') })) });
  let best = Number.isInteger(r?.best) && r.best >= 0 && r.best < cands.length ? r.best : -1;
  if (Array.isArray(r?.scores) && best >= 0 && Number(r.scores[best]) < 7) best = -1;   // enforce the threshold even if the model forgot
  return { best, reason: String(r?.reason || ''), scores: r?.scores };
}
