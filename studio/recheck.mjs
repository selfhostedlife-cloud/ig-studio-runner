// Re-runs the search-grounded fact-check on an existing post's claims. Usage: node recheck.mjs <postDir>
import fs from 'node:fs';
import path from 'node:path';
import { factCheck } from './agents.mjs';
const dir = process.argv[2];
const rv = JSON.parse(fs.readFileSync(path.join(dir, 'review.json'), 'utf8'));
const claims = rv.claims || [];
console.log(`Checking ${claims.length} claims...`);
const fc = await factCheck(claims);
rv.factcheck = { ok: fc.ok, unverified: !!fc.unverified, issues: fc.issues, rechecked_at: new Date().toISOString() };
rv.raw_factcheck = fc.raw;
fs.writeFileSync(path.join(dir, 'review.json'), JSON.stringify(rv, null, 2));
console.log(fc.unverified ? 'STILL UNVERIFIED (quota)' : (fc.ok ? 'No WRONG/UNSURE verdicts.' : 'FLAGGED:\n' + fc.issues.join('\n')));
console.log('\n--- full verdicts ---\n' + (fc.raw || '').slice(0, 3500));
