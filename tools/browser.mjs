/* Find a chromium that actually launches.
 *
 * The growth job runs in an environment with playwright and its browsers
 * already installed globally. Running `npm install` there pulls a *different*
 * playwright into node_modules, which then looks for a browser build number
 * that isn't on disk and dies with "Executable doesn't exist". The checks go
 * red, the job reads red as "stop and repair", and the day produces nothing.
 *
 * So: don't trust one resolution path. Try the module, and if launching fails,
 * point it at whatever browser is actually installed.
 */

import { execSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const BROWSER_ROOT = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';

/* Local devDependency first, then a global install. The CommonJS build lands
 * under .default when imported by path, so unwrap either shape. */
export async function loadPlaywright() {
  const unwrap = (m) => (m.chromium ? m : m.default);
  try {
    return unwrap(await import('playwright'));
  } catch {
    try {
      const root = execSync('npm root -g', { encoding: 'utf8' }).trim();
      return unwrap(await import(pathToFileURL(join(root, 'playwright/index.js')).href));
    } catch {
      console.error('playwright not found — run: npm i -D playwright && npx playwright install chromium');
      process.exit(1);
    }
  }
}

/* A browser on disk, whatever version it happens to be. */
function installedChrome() {
  const direct = join(BROWSER_ROOT, 'chromium');
  if (existsSync(direct)) return direct;

  if (!existsSync(BROWSER_ROOT)) return null;
  for (const dir of readdirSync(BROWSER_ROOT).sort().reverse()) {
    if (!dir.startsWith('chromium-')) continue;
    const exe = join(BROWSER_ROOT, dir, 'chrome-linux', 'chrome');
    if (existsSync(exe)) return exe;
  }
  return null;
}

export async function launchChromium(options = {}) {
  const { chromium } = await loadPlaywright();

  try {
    return await chromium.launch(options);
  } catch (err) {
    const exe = installedChrome();
    if (!exe) throw err;
    console.error(`(playwright's own browser is missing; using ${exe})`);
    return await chromium.launch({ ...options, executablePath: exe });
  }
}
