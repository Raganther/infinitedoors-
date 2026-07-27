/* Static file server. Enough to play the game locally and to drive the smoke
 * test — no dependencies, no configuration.
 *
 *   node tools/serve.mjs [port]
 */

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8',
};

export function serve(port = 0, root = process.cwd()) {
  const server = createServer(async (req, res) => {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const rel = normalize(path === '/' ? 'index.html' : path.slice(1));

    if (rel.startsWith('..')) {
      res.writeHead(403).end('no');
      return;
    }

    try {
      const body = await readFile(join(root, rel));
      res.writeHead(200, {
        'content-type': TYPES[extname(rel)] || 'application/octet-stream',
        'cache-control': 'no-store',
      }).end(body);
    } catch {
      res.writeHead(404).end('not found');
    }
  });

  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () =>
      resolve({ server, port: server.address().port }));
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { port } = await serve(Number(process.argv[2]) || 8080);
  console.log(`infinite doors → http://127.0.0.1:${port}`);
}
