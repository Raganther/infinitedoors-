/* Screenshot a scene so you can actually look at what you built.
 *
 * The validator checks that a scene is correct. It cannot tell you it is ugly.
 *
 *   node tools/shot.mjs                 # every scene
 *   node tools/shot.mjs ship-hold       # one scene
 *   node tools/shot.mjs ship-hold --raw # artwork only, no title or captions
 */

import { execSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { mkdir } from 'node:fs/promises';
import { serve } from './serve.mjs';
import { buildManifest } from './build-manifest.mjs';

const OUT = 'shots';

async function loadPlaywright() {
  const unwrap = (m) => (m.chromium ? m : m.default);
  try {
    return unwrap(await import('playwright'));
  } catch {
    const root = execSync('npm root -g', { encoding: 'utf8' }).trim();
    return unwrap(await import(pathToFileURL(`${root}/playwright/index.js`).href));
  }
}

const args = process.argv.slice(2);
const raw = args.includes('--raw');
const only = args.filter((a) => !a.startsWith('--'));

const { chromium } = await loadPlaywright();
const manifest = await buildManifest();
const ids = only.length ? only : manifest.scenes.map((s) => s.id);

await mkdir(OUT, { recursive: true });
const { server, port } = await serve(0);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

for (const id of ids) {
  await page.goto(`http://127.0.0.1:${port}/#/${id}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__doors && !window.__doors.busy, null, { timeout: 10000 });
  if (raw) {
    await page.evaluate(() => {
      document.getElementById('chrome').style.display = 'none';
      document.getElementById('controls').style.display = 'none';
    });
  }
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/${id}.png` });
  console.log(`${OUT}/${id}.png`);
}

await browser.close();
server.close();
