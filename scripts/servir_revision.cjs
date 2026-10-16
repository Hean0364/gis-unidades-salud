// Servidor local de solo lectura. No expone .git, secretos ni rutas fuera del proyecto.
'use strict';
const http = require('node:http'), fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '..'), port = Number(process.env.REVISION_PORT || 8080);
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.cjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.geojson': 'application/geo+json; charset=utf-8', '.csv': 'text/csv; charset=utf-8' };
const server = http.createServer((req, res) => {
  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
  try {
    const urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (urlPath.split('/').some(s => s.startsWith('.'))) throw Error('Ruta no permitida');
    const target = path.resolve(root, '.' + (urlPath === '/' ? '/index_revision_publicos.html' : urlPath));
    if (!target.startsWith(root + path.sep) || !mime[path.extname(target)]) throw Error('Ruta no permitida');
    const real = fs.realpathSync(target); if (!real.startsWith(root + path.sep)) throw Error('Ruta no permitida');
    if (!fs.statSync(real).isFile()) throw Error('Archivo no disponible');
    res.writeHead(200, { 'Content-Type': mime[path.extname(real)], 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    if (req.method === 'HEAD') res.end(); else fs.createReadStream(real).pipe(res);
  } catch { res.writeHead(404); res.end('Archivo no disponible'); }
});
server.on('error', err => { console.error(err.message); process.exitCode = 1; });
server.listen(port, '127.0.0.1', () => console.log(`Revisión local: http://127.0.0.1:${port}/index_revision_publicos.html`));
