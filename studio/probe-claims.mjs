import { gemini } from './agents.mjs';
const q = [
 'Does India\'s DGFT Foreign Trade Policy exempt exporters from needing an RCMC (Registration-cum-Membership Certificate) for exports/shipments up to a FOB value of Rs 3 lakh? Cite the exact FTP/HBP paragraph and notification if it exists. Also: is RCMC required to EXPORT at all, or only to claim FTP benefits/authorisations? Be precise; say NOT FOUND if you cannot find such a Rs 3 lakh exemption.',
 'What is the current RBI/FEMA time limit for realisation of export proceeds in India (as of 2026)? Was the 15-month window a temporary COVID relaxation, when did it end, and has RBI announced any NEW change to the 9-month rule in 2025 or 2026? Be precise and cite what you find; say NOT FOUND if there is no recent change.',
];
for (const x of q) { console.log('\n=== QUESTION: ' + x.slice(0, 110) + '...\n'); console.log((await gemini(x, { json: false, search: true })).slice(0, 2600)); }
