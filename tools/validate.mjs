/* The reviewer.
 *
 * Nobody reads the growth job's diffs at 3am, so this file has to. Every rule
 * here exists because breaking it produces a world that is broken, unplayable,
 * ugly, or unable to keep growing. If a rule ever blocks something genuinely
 * good, change the rule deliberately — do not route around it.
 *
 *   node tools/validate.mjs
 */

import { readFile, stat, readdir } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { readScenes, ENTRY } from './build-manifest.mjs';

const SCENES = 'world/scenes';
const MAX_SVG_KB = 90;
const MIN_HOTSPOTS = 2;
const MIN_WORLD_FRONTIERS = 3;
const VIEWBOX = '0 0 1600 900';
const ACTIONS = ['goto', 'animate', 'text', 'frontier'];
const ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const SHAPE_RE = /^#[A-Za-z][-\w]*$/;

const problems = [];
const fail = (where, msg) => problems.push(`${where}: ${msg}`);

/* ---------------------------------------------------------------------- */

const palette = JSON.parse(await readFile('world/palette.json', 'utf8'));
const allowedColors = new Set(
  [...Object.values(palette.colors), ...palette.always_allowed]
    .map((c) => c.toLowerCase())
);

/* ---- Soundscape --------------------------------------------------------
 * The audio equivalent of the palette: a small set of named synth patches
 * that scenes reference. Levels are capped here because nobody is wearing
 * headphones at 3am to catch a run that ships a scream. */

const SOUND_KINDS = ['drone', 'noise', 'blip', 'swell'];
const BED_GAIN_MAX = 0.08;
const SHOT_GAIN_MAX = 0.3;

const soundscape = JSON.parse(await readFile('world/soundscape.json', 'utf8'));
const soundNames = new Set(Object.keys(soundscape.patches || {}));

for (const [name, p] of Object.entries(soundscape.patches || {})) {
  const at = `world/soundscape.json patch "${name}"`;
  if (!ID_RE.test(name)) fail(at, 'patch names are kebab-case');
  if (!SOUND_KINDS.includes(p.kind)) fail(at, `kind must be one of ${SOUND_KINDS.join(', ')}`);
  if (typeof p.gain !== 'number' || p.gain <= 0) fail(at, 'needs a positive "gain"');
  const cap = (p.kind === 'drone' || p.kind === 'noise') ? BED_GAIN_MAX : SHOT_GAIN_MAX;
  if (p.gain > cap) fail(at, `gain ${p.gain} exceeds the ${cap} cap for ${p.kind} — quiet is the register of this world`);
  if ((p.kind === 'drone' || p.kind === 'blip')) {
    if (typeof p.freq !== 'number' || p.freq < 25 || p.freq > 4200) fail(at, `freq must be 25-4200 Hz, got ${p.freq}`);
  }
  if (p.kind === 'blip' && p.fall !== undefined && (p.fall < 25 || p.fall > 4200)) {
    fail(at, `fall is a target frequency, 25-4200 Hz, got ${p.fall}`);
  }
}

// Engine defaults must exist or every door goes silent.
for (const required of ['door-pass', 'door-shut']) {
  if (!soundNames.has(required)) fail('world/soundscape.json', `missing "${required}" — the engine plays it by default`);
}

const scenes = await readScenes();
const byId = new Map();

for (const { file, data } of scenes) {
  const stem = basename(file, '.json');
  if (data.id !== stem) fail(file, `id "${data.id}" does not match filename "${stem}"`);
  if (byId.has(data.id)) fail(file, `duplicate scene id "${data.id}"`);
  byId.set(data.id, data);
}

if (!byId.has(ENTRY)) fail('world', `entry scene "${ENTRY}" does not exist`);

/* ---- Per-scene -------------------------------------------------------- */

const artCache = new Map();

for (const { file, data } of scenes) {
  const where = `${SCENES}/${file}`;

  if (!ID_RE.test(data.id || '')) fail(where, `id must be kebab-case, got "${data.id}"`);
  if (!data.title) fail(where, 'missing "title"');
  if (data.title && data.title.length > 40) fail(where, `title over 40 chars: "${data.title}"`);
  if (!data.art) fail(where, 'missing "art"');

  if (!Number.isInteger(data.craft) || data.craft < 2 || data.craft > 5) {
    fail(where, `"craft" must be an integer 2-5 (see the ladder in STYLE.md), got ${JSON.stringify(data.craft)}`);
  }

  if (!Array.isArray(data.ambience) || data.ambience.length < 1 || data.ambience.length > 2) {
    fail(where, 'needs "ambience": 1-2 patch names from world/soundscape.json — every scene has air');
  } else {
    for (const name of data.ambience) {
      if (!soundNames.has(name)) fail(where, `ambience "${name}" is not in world/soundscape.json`);
      else if (!['drone', 'noise'].includes(soundscape.patches[name].kind)) {
        fail(where, `ambience "${name}" is a one-shot (${soundscape.patches[name].kind}) — beds must be drone or noise`);
      }
    }
  }

  const spots = data.hotspots;
  if (!Array.isArray(spots)) {
    fail(where, 'missing "hotspots" array');
    continue;
  }
  if (spots.length < MIN_HOTSPOTS) {
    fail(where, `only ${spots.length} hotspot(s); every scene must reward at least ${MIN_HOTSPOTS} clicks`);
  }

  // Load artwork.
  let svg = '';
  if (data.art) {
    try {
      svg = await readFile(data.art, 'utf8');
      artCache.set(data.id, svg);
      const kb = (await stat(data.art)).size / 1024;
      if (kb > MAX_SVG_KB) {
        fail(where, `artwork is ${kb.toFixed(0)}kB, budget is ${MAX_SVG_KB}kB — simplify it`);
      }
    } catch {
      fail(where, `artwork "${data.art}" not found`);
    }
  }

  if (svg) {
    if (!svg.includes(`viewBox="${VIEWBOX}"`)) {
      fail(data.art, `must declare viewBox="${VIEWBOX}" so scenes cut together`);
    }
    if (!/<title>/.test(svg)) {
      fail(data.art, 'missing <title> — needed for screen readers');
    }

    // Rung 4 on the craft ladder is "alive": ambient motion belonging to the
    // place, not a triggered clip. Checking it mechanically is what stops an
    // ENRICH run banking the number without doing the drawing.
    if (data.craft >= 4) {
      if (!/animation:[^;]*\binfinite\b/.test(svg)) {
        fail(data.art, `claims craft ${data.craft} but has no ambient (infinite) animation — rung 4 is "alive", see STYLE.md`);
      }
      if (!/prefers-reduced-motion/.test(svg)) {
        fail(data.art, `claims craft ${data.craft} but never honours prefers-reduced-motion — ambient motion must be optional`);
      }
    }

    // Locked palette. This is the single strongest guard against style drift
    // over hundreds of unattended runs.
    const hexes = svg.match(/#[0-9a-fA-F]{3,8}\b/g) || [];
    const seen = new Set();
    for (const hex of hexes) {
      const h = hex.toLowerCase();
      // Ignore url(#id) references and other non-colour hashes.
      if (!/^#[0-9a-f]{6}$/.test(h) && !/^#[0-9a-f]{3}$/.test(h)) continue;
      if (!allowedColors.has(h) && !seen.has(h)) {
        seen.add(h);
        fail(data.art, `colour ${h} is not in world/palette.json`);
      }
    }
  }

  // Hotspots.
  const shapesSeen = new Set();
  let exits = 0;

  for (const [i, spot] of spots.entries()) {
    const at = `${where} hotspot[${i}]`;

    if (!spot.shape || !SHAPE_RE.test(spot.shape)) {
      fail(at, `"shape" must be an id selector like "#door-warm", got ${JSON.stringify(spot.shape)}`);
    } else {
      if (shapesSeen.has(spot.shape)) fail(at, `"${spot.shape}" is claimed twice in this scene`);
      shapesSeen.add(spot.shape);

      const id = spot.shape.slice(1);
      if (svg && !new RegExp(`id="${id}"`).test(svg)) {
        fail(at, `no element with id="${id}" in ${data.art}`);
      }
    }

    if (!spot.label) fail(at, 'missing "label" (screen reader name)');
    if (!ACTIONS.includes(spot.action)) {
      fail(at, `action must be one of ${ACTIONS.join(', ')}, got ${JSON.stringify(spot.action)}`);
    }

    if (spot.sound !== undefined) {
      if (!soundNames.has(spot.sound)) fail(at, `sound "${spot.sound}" is not in world/soundscape.json`);
      else if (!['blip', 'swell'].includes(soundscape.patches[spot.sound].kind)) {
        fail(at, `sound "${spot.sound}" is a bed (${soundscape.patches[spot.sound].kind}) — clicks play blip or swell`);
      }
    }

    switch (spot.action) {
      case 'goto':
        exits++;
        if (!spot.target) fail(at, 'goto needs a "target"');
        else if (!byId.has(spot.target)) fail(at, `goto target "${spot.target}" does not exist`);
        else if (spot.target === data.id) fail(at, 'goto points at its own scene');
        break;

      case 'animate':
        if (!spot.clip) fail(at, 'animate needs a "clip"');
        else if (svg && !svg.includes(spot.clip)) {
          fail(at, `clip "${spot.clip}" is never defined in ${data.art}`);
        }
        if (spot.clipTarget && svg && !new RegExp(`id="${spot.clipTarget}"`).test(svg)) {
          fail(at, `clipTarget "${spot.clipTarget}" not found in ${data.art}`);
        }
        break;

      case 'text':
        if (!spot.text) fail(at, 'text action needs "text"');
        break;

      case 'frontier':
        if (!spot.hint) {
          fail(at, 'frontier needs a "hint" — it is the seed a future run grows from');
        }
        if (spot.target) fail(at, 'frontier must not have a target; make it a goto instead');
        break;
    }
  }

  if (exits === 0) {
    fail(where, 'no goto hotspot — every scene needs a way onward that is not the back button');
  }
}

/* ---- World-level ------------------------------------------------------ */

// Reachability: an unreachable scene is wasted work nobody will ever see.
if (byId.has(ENTRY)) {
  const reached = new Set([ENTRY]);
  const queue = [ENTRY];
  while (queue.length) {
    const scene = byId.get(queue.shift());
    for (const spot of scene.hotspots || []) {
      if (spot.action === 'goto' && byId.has(spot.target) && !reached.has(spot.target)) {
        reached.add(spot.target);
        queue.push(spot.target);
      }
    }
  }
  for (const id of byId.keys()) {
    if (!reached.has(id)) {
      fail(`${SCENES}/${id}.json`, `unreachable from "${ENTRY}" — link it in from an existing scene`);
    }
  }
}

// Flags: a gate whose key is never granted is a permanently dead hotspot.
const granted = new Set();
const required = new Map();
for (const { data } of scenes) {
  for (const spot of data.hotspots || []) {
    if (spot.sets) granted.add(spot.sets);
    if (spot.requires) required.set(spot.requires, data.id);
  }
}
for (const [flag, scene] of required) {
  if (!granted.has(flag)) {
    fail(`${SCENES}/${scene}.json`, `requires flag "${flag}" which no hotspot ever sets`);
  }
}

// Orphaned art.
const artFiles = (await readdir(SCENES)).filter((f) => f.endsWith('.svg'));
const usedArt = new Set(scenes.map(({ data }) => basename(data.art || '')));
for (const f of artFiles) {
  if (!usedArt.has(f)) fail(join(SCENES, f), 'artwork not referenced by any scene');
}

// The growth guarantee. If runs consume frontiers without leaving new ones,
// the world eventually has nowhere left to go. Fail loudly before that.
const frontierCount = scenes.reduce(
  (n, { data }) => n + (data.hotspots || []).filter((s) => s.action === 'frontier').length, 0
);
if (frontierCount < MIN_WORLD_FRONTIERS) {
  fail('world', `only ${frontierCount} open frontier(s); the world must always keep at least ${MIN_WORLD_FRONTIERS} unopened doors`);
}

/* ---- Report ----------------------------------------------------------- */

if (problems.length) {
  console.error(`\n✗ ${problems.length} problem${problems.length === 1 ? '' : 's'}:\n`);
  for (const p of problems) console.error(`  ${p}`);
  console.error('');
  process.exit(1);
}

console.log(
  `✓ ${scenes.length} scenes, ${frontierCount} open frontiers, ` +
  `palette locked to ${allowedColors.size} colours`
);
