const ROOT = process.env.IG_ROOT || 'C:/Users/smfab/ig-automation';
import fs from 'node:fs';
const f = (ROOT + '/studio/data/leadmagnets.json');
const j = JSON.parse(fs.readFileSync(f, 'utf8'));
const add = { TOWELMAP: ['1-bfvcvaigYiZL5pwNL65woNXg8LJsRrO', 'Cotton terry towels Buyer Map Top 10 Countries (2023)'], SHOEMAP: ['12AVpSPxL5D2_afzTOwtjKJeu3vK1N8sK', 'Footwear with leather uppers Buyer Map Top 10 Countries (2023)'], TURMERICMAP: ['1ISinztkA5pJOyb7oohXlyp8r0xOQRDjB', 'Turmeric Buyer Map Top 10 Countries (2023)'], CORIANDERMAP: ['1wCCI1fZ6u3A3lmBp7-la60Dz1nY1GXcr', 'Coriander seeds Buyer Map Top 10 Countries (2023)'], SHIRTMAP: ['1sVB16IH3BcYjvT5cdJeIqTzFLyDMyeID', "Men's cotton shirts Buyer Map Top 10 Countries (2023)"], PHARMAMAP: ['11hAJ1-LK9rLqY7N3WwdPy0XC2oSvRV3s', 'Medicines in measured doses (HS 3004.90) Buyer Map Top 10 Countries (2023)'], TSHIRTMAP: ['1XpPMx8W9eYhwmAXybkxuaUlr682KH0fx', 'Cotton T-shirts (knitted) Buyer Map Top 10 Countries (2023)'], RICEMAP: ['144hNVX3aEO-yYCXtFnF257IC6ytR62o2', 'Rice (semiwholly milled) Buyer Map Top 10 Countries (2023)'], FREIGHT: ['1kRGssdB3K7iNEqdH36vS-9k12G-5viNp', 'Freight Costing Sheet & Surcharge Checklist'] };
for (const [k, [id, t]] of Object.entries(add)) j.magnets[k] = { file: `${k} - ${t}.pdf`, fileId: id, viewLink: `https://drive.google.com/file/d/${id}/view?usp=sharing` };
fs.writeFileSync(f, JSON.stringify(j, null, 2));
console.log(Object.keys(j.magnets).join(', '));
