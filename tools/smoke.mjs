/* Plays the whole world in a real browser.
 *
 * Static validation proves the data is consistent. This proves the game
 * actually works: that every hotspot binds, that nothing invisible is sitting
 * on top of a door swallowing clicks, and that every exit goes where it says.
 *
 *   node tools/smoke.mjs
 */

import { serve } from './serve.mjs';
import { buildManifest } from './build-manifest.mjs';
import { launchChromium } from './browser.mjs';

const failures = [];
const note = (msg) => failures.push(msg);

const manifest = await buildManifest();
const { server, port } = await serve(0);
const base = `http://127.0.0.1:${port}`;

const browser = await launchChromium();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

let scope = 'boot';
page.on('console', (m) => {
  if (m.type() === 'error') note(`${scope}: console error — ${m.text()}`);
  if (m.type() === 'warning' && m.text().includes('infinite-doors')) {
    note(`${scope}: ${m.text()}`);
  }
});
page.on('pageerror', (e) => note(`${scope}: uncaught — ${e.message}`));

/* Wait for the engine to be idle rather than guessing at a duration — a click
 * delivered mid-transition is silently dropped, which would make every test
 * below pass for the wrong reason. */
const idle = (ms = 10000) =>
  page.waitForFunction(() => window.__doors && !window.__doors.busy, null, { timeout: ms });

/* Every scene is tested from a cold start, so flag-gated hotspots really are
 * locked and one scene's clicks cannot leak into the next.
 *
 * The wipe runs before the page's own scripts on every navigation. Clearing
 * after load and reloading would also work, but it aborts whatever the engine
 * already had in flight, and the resulting "Failed to fetch" reads as a broken
 * world. An intermittent red is as costly here as a real one — it sends the
 * growth job into REPAIR and eats the day. */
await page.addInitScript(() => {
  try { localStorage.clear(); } catch { /* opaque origin; nothing to clear */ }
});

async function open(id) {
  // Passing through about:blank forces a real document load — a hash-only
  // goto would neither reload the page nor re-run the storage wipe, and
  // flags clicked in one scene would leak into the next scene's cold start.
  await page.goto('about:blank');
  await page.goto(`${base}/#/${id}`, { waitUntil: 'load' });
  await idle();
}

/* ---- Every scene renders, and every hotspot is live ------------------- */

for (const scene of manifest.scenes) {
  scope = scene.id;
  await open(scene.id);

  if (await page.locator('#scene .broken').count()) {
    note(`${scene.id}: failed to load — ${await page.locator('#scene .broken').innerText()}`);
    continue;
  }
  if (!(await page.locator('#scene svg').count())) {
    note(`${scene.id}: no <svg> rendered`);
    continue;
  }

  const source = JSON.parse(
    await (await fetch(`${base}/world/scenes/${scene.id}.json`)).text()
  );

  for (const spot of source.hotspots) {
    const sel = `#scene ${spot.shape}`;
    const el = page.locator(sel).first();

    if (!(await el.count())) {
      note(`${scene.id}: ${spot.shape} is not in the artwork`);
      continue;
    }

    // A hotspot gated behind a flag we have not earned is correctly inert.
    const gated = Boolean(spot.requires);
    const bound = await el.evaluate((n) => n.classList.contains('hotspot'));

    if (!gated && !bound) {
      note(`${scene.id}: ${spot.shape} never got bound by the engine`);
      continue;
    }
    if (gated && bound) {
      note(`${scene.id}: ${spot.shape} requires "${spot.requires}" but is live from a cold start`);
    }
    if (!bound) continue;

    // Clicking must reach the element. If a decorative overlay is in the way,
    // this is where we find out.
    if (spot.action === 'goto') continue;

    try {
      await el.click({ timeout: 4000 });
    } catch {
      note(`${scene.id}: ${spot.shape} is not clickable — something is drawn on top of it`);
      continue;
    }

    // A hotspot that carries prose must actually say it. This is what proves
    // the click was handled rather than merely landing on the right pixels.
    if (spot.text) {
      const spoke = await page
        .waitForFunction(
          (t) => {
            const el = document.getElementById('toast');
            return el.classList.contains('shown') && el.textContent === t;
          },
          spot.text,
          { timeout: 3000 }
        )
        .then(() => true, () => false);
      if (!spoke) note(`${scene.id}: ${spot.shape} was clicked but said nothing`);
    }
  }

  // The clicks above were real gestures, so the audio context should have
  // unlocked, and every patch the scene named should have resolved. A
  // missing patch is silent for a player — this is the only place it shows.
  const sound = await page.evaluate(() => window.__doors.audio);
  if (sound.error) note(`${scene.id}: audio failed to start — ${sound.error}`);
  if (sound.patches === 0) note(`${scene.id}: soundscape.json never loaded`);
  for (const name of sound.missing) {
    note(`${scene.id}: names sound "${name}" which did not resolve`);
  }
}

/* ---- Every exit goes where it claims ---------------------------------- */

for (const scene of manifest.scenes) {
  const source = JSON.parse(
    await (await fetch(`${base}/world/scenes/${scene.id}.json`)).text()
  );

  for (const spot of source.hotspots.filter((s) => s.action === 'goto')) {
    scope = `${scene.id} → ${spot.target}`;
    await open(scene.id);

    try {
      await page.locator(`#scene ${spot.shape}`).first().click({ timeout: 4000 });
    } catch {
      note(`${scene.id}: exit ${spot.shape} is not clickable — something is drawn on top of it`);
      continue;
    }

    const arrived = await page
      .waitForFunction(
        (t) => window.__doors.current === t && !window.__doors.busy,
        spot.target,
        { timeout: 8000 }
      )
      .then(() => true, () => false);

    if (!arrived) {
      const landed = await page.evaluate(() => window.__doors.current);
      note(`${scene.id}: ${spot.shape} claims "${spot.target}" but landed on "${landed}"`);
    }
  }
}

/* ---- Entry point ------------------------------------------------------ */

scope = 'entry';
await page.goto(base, { waitUntil: 'load' });
await idle();
if ((await page.evaluate(() => window.__doors.current)) !== manifest.entry) {
  note(`cold start did not land on "${manifest.entry}"`);
}

/* ---- Report ----------------------------------------------------------- */

await browser.close();
server.close();

if (failures.length) {
  console.error(`\n✗ ${failures.length} problem${failures.length === 1 ? '' : 's'} playing the world:\n`);
  for (const f of [...new Set(failures)]) console.error(`  ${f}`);
  console.error('');
  process.exit(1);
}

const clicks = manifest.counts.exits + manifest.counts.interactions + manifest.counts.frontiers;
console.log(`✓ played ${manifest.counts.scenes} scenes, ${clicks} hotspots, no errors`);
