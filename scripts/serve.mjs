/** Serve o build final como ele será publicado. */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { RAIZ, carregarProjeto, idDoArgumento, encerrarComErro } from './comum.mjs';

const MIME = { '.html': 'text/html; charset=utf-8', '.json': 'application/json; charset=utf-8', '.xml': 'application/xml; charset=utf-8', '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' };

function servirStandalone(projeto, dir) {
  const port = Number(process.env.PORT || 3000);
  const base = projeto.baseUrl.replace(/\/+$/, '') || '';
  const server = http.createServer((req, res) => {
    let pathname;
    try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
    catch { res.writeHead(400); res.end('Bad request'); return; }
    if (base && pathname.startsWith(base)) pathname = pathname.slice(base.length) || '/';
    let relativo = pathname.replace(/^\/+/, '');
    if (!relativo || relativo.endsWith('/')) relativo += 'index.html';
    let alvo = path.resolve(dir, relativo);
    if (!alvo.startsWith(path.resolve(dir) + path.sep) && alvo !== path.resolve(dir, 'index.html')) {
      res.writeHead(403); res.end('Forbidden'); return;
    }
    if (!fs.existsSync(alvo) || !fs.statSync(alvo).isFile()) {
      if (path.extname(relativo)) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end('Not found');
        return;
      }
      alvo = path.join(dir, 'index.html');
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(alvo).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(alvo).pipe(res);
  });
  server.listen(port, '127.0.0.1', () => {
    console.log(`Standalone em http://127.0.0.1:${port}${projeto.baseUrl}`);
    console.log('Ctrl+C para encerrar.');
  });
}

try {
  const id = idDoArgumento();
  const projeto = carregarProjeto(id);
  const modo = process.env.DOC_MODO === 'publico' ? 'publico' : 'interno';
  const dir = modo === 'publico' ? projeto.dirBuildCliente : projeto.dirBuild;
  if (!fs.existsSync(dir)) {
    throw new Error(`Build não encontrado em ${path.relative(RAIZ, dir)}.\nRode \`npm run build -- ${id}\` antes.`);
  }
  servirStandalone(projeto, dir);
} catch (e) { encerrarComErro(e); }
