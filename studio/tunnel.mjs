// Temporary public URL for local files (Cloudflare quick tunnel, no account).
// Instagram's API fetches media from a public URL; we open the tunnel only while it fetches, then close it.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const CLOUDFLARED = path.join(here, '..', 'tools', 'cloudflared.exe');
const TYPES = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.mp4': 'video/mp4', '.pdf': 'application/pdf' };

// Serves ONLY files inside `dir`, read-only. Returns { url(fileName), close() }.
export async function openTunnel(dir) {
  const server = http.createServer((req, res) => {
    const name = path.basename(decodeURIComponent((req.url || '/').split('?')[0]));
    const file = path.join(dir, name);
    if (!name || !file.startsWith(path.resolve(dir)) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Content-Length': fs.statSync(file).size });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;

  const proc = spawn(CLOUDFLARED, ['tunnel', '--no-autoupdate', '--url', `http://127.0.0.1:${port}`], { stdio: ['ignore', 'pipe', 'pipe'] });
  const base = await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('Tunnel did not start in 45s')), 45000);
    const onData = (b) => { const m = String(b).match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/); if (m) { clearTimeout(t); resolve(m[0]); } };
    proc.stdout.on('data', onData); proc.stderr.on('data', onData);
    proc.on('exit', () => reject(new Error('cloudflared exited early')));
  });
  return {
    url: (fileName) => `${base}/${encodeURIComponent(fileName)}`,
    close: () => { try { proc.kill(); } catch {} server.close(); },
  };
}

// CLI self-test: node tunnel.mjs <dir> <file>
if (process.argv[1] && process.argv[1].endsWith('tunnel.mjs') && process.argv[2]) {
  const t = await openTunnel(process.argv[2]);
  const u = t.url(process.argv[3]);
  console.log('public url:', u);
  await new Promise((r) => setTimeout(r, 4000)); // DNS/edge warm-up
  const r = await fetch(u);
  console.log('fetch via tunnel:', r.status, r.headers.get('content-type'), (await r.arrayBuffer()).byteLength, 'bytes');
  t.close();
}
