// Zero-dependency static file server for the repo root. `npm run dev` serves http://localhost:8080/.
// The other tools import startServer() and bind an ephemeral port so tests never collide with a dev server.
import http from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
};

export function startServer({ port = 8080, root = REPO_ROOT, quiet = false } = {}) {
  return new Promise((resolveStart, reject) => {
    const server = http.createServer((req, res) => {
      let pathname;
      try {
        pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      } catch {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end(`Bad request: ${req.url} is not a valid percent-encoded path`);
        return;
      }
      if (pathname.endsWith('/')) pathname += 'index.html';
      const file = resolve(join(root, pathname));
      if (file !== root && !file.startsWith(root + sep)) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end(`Forbidden: ${pathname} resolves outside the served root`);
        return;
      }
      let stat;
      try {
        stat = statSync(file);
      } catch {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end(`Not found: ${pathname} (no such file under ${root})`);
        return;
      }
      if (stat.isDirectory()) {
        res.writeHead(301, { Location: `${pathname}/` });
        res.end();
        return;
      }
      res.writeHead(200, {
        'Content-Type': MIME[extname(file).toLowerCase()] || 'application/octet-stream',
        'Content-Length': stat.size,
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*',
      });
      if (req.method === 'HEAD') {
        res.end();
        return;
      }
      createReadStream(file).pipe(res);
    });
    server.on('error', reject);
    server.listen(port, () => {
      const actualPort = server.address().port;
      const url = `http://127.0.0.1:${actualPort}`;
      if (!quiet) console.log(`serving ${root} at http://localhost:${actualPort}/ (Ctrl+C to stop)`);
      resolveStart({
        server,
        port: actualPort,
        url,
        close: () => new Promise((done) => server.close(done)),
      });
    });
  });
}

// True when THE CALLER's module is the one node was asked to run, false when it is being imported.
// `metaUrl` is the caller's `import.meta.url`: this is exported so a tool does not have to hand-build the
// comparison, because a hand-built one is how `blackframe` and `record` came to skip their whole main
// block on every CI run for three days (docs/learning/gate-proofs.md).
//
// The `!process.argv[1]` line is not decoration. Under `node --input-type=module -e '…'` there is no
// argv[1] at all, and `resolve(undefined)` throws rather than returning false -- so without it an import
// from an eval'd node would crash instead of being inert. Exercised by out/scratch/import-inert.mjs.
export function isMainModule(metaUrl) {
  if (!process.argv[1]) return false;
  const a = resolve(process.argv[1]).toLowerCase();
  const b = fileURLToPath(metaUrl).toLowerCase();
  return a === b;
}

if (isMainModule(import.meta.url)) {
  const port = Number(process.env.PORT || 8080);
  startServer({ port }).catch((err) => {
    console.error(`dev server failed to start on port ${port}: ${err.message}`);
    process.exit(1);
  });
}
