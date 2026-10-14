// Temporary local server that serves ONLY the listed PDFs on 127.0.0.1 so a browser page can fetch them (used to drop files into Google Drive).
// Usage: node serve-pdfs.mjs <port> <minutes> <file1.pdf> <file2.pdf> ...
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const [port, minutes, ...files] = process.argv.slice(2);
const allowed = Object.fromEntries(files.map((f) => [path.basename(f), f]));
const server = http.createServer((req, res) => {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Private-Network': 'true', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': '*' };
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
  const name = decodeURIComponent((req.url || '/').split('?')[0].slice(1));
  const file = allowed[name];
  if (!file || !fs.existsSync(file)) { res.writeHead(404, cors); return res.end('not found'); }
  res.writeHead(200, { ...cors, 'Content-Type': 'application/pdf', 'Content-Length': fs.statSync(file).size });
  fs.createReadStream(file).pipe(res);
});
server.listen(Number(port), '127.0.0.1', () => console.log('serving', Object.keys(allowed).join(', '), 'on', port, 'for', minutes, 'min'));
setTimeout(() => { server.close(); process.exit(0); }, Number(minutes) * 60000);
