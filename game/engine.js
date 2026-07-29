/* Infinite Doors — engine.
 *
 * This file is deliberately small and deliberately stable. The world grows by
 * adding data (world/scenes/*.json + *.svg), not by editing this file. If a
 * growth run finds itself wanting to change the engine, that is a signal the
 * scene grammar is missing something — extend the grammar, in its own commit,
 * with tools/validate.mjs updated to match.
 *
 * Scene grammar is documented in world/schema.json.
 */

const ENTRY = 'hall-of-doors';
const SAVE_KEY = 'infinitedoors.save.v1';
const IDLE_HINT_MS = 25000;

const el = {
  scene: document.getElementById('scene'),
  veil: document.getElementById('veil'),
  title: document.getElementById('title'),
  caption: document.getElementById('caption'),
  toast: document.getElementById('toast'),
  back: document.getElementById('btn-back'),
  hint: document.getElementById('btn-hint'),
  mute: document.getElementById('btn-mute'),
};

const cache = new Map();
let current = null;
let navigating = false;
let idleTimer = null;
let toastTimer = null;

/* ---- Persistent state ------------------------------------------------- */

const save = load();

function load() {
  const blank = { flags: {}, visited: [], fired: [], trail: [], muted: false };
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? { ...blank, ...JSON.parse(raw) } : blank;
  } catch {
    return blank;
  }
}

function persist() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    /* Private browsing, quota, whatever. The game still plays. */
  }
}

const hasFlag = (name) => Boolean(save.flags[name]);

function setFlag(name) {
  if (!name || save.flags[name]) return;
  save.flags[name] = true;
  persist();
}

function markFired(key) {
  if (!save.fired.includes(key)) {
    save.fired.push(key);
    persist();
  }
}

/* ---- Loading ---------------------------------------------------------- */

async function fetchScene(id) {
  if (cache.has(id)) return cache.get(id);

  const res = await fetch(`world/scenes/${id}.json`, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`scene "${id}" not found (${res.status})`);
  const scene = await res.json();

  const artRes = await fetch(scene.art, { cache: 'no-cache' });
  if (!artRes.ok) throw new Error(`artwork "${scene.art}" not found (${artRes.status})`);
  scene.svg = await artRes.text();

  cache.set(id, scene);
  return scene;
}

async function goto(id, { record = true } = {}) {
  if (navigating) return;
  navigating = true;

  try {
    await veil(true);
    const scene = await fetchScene(id);
    render(scene);

    if (record && current && current.id !== id) {
      save.trail.push(current.id);
      if (save.trail.length > 64) save.trail.shift();
    }
    current = scene;
    audio.ambience(scene.ambience);

    if (!save.visited.includes(id)) save.visited.push(id);
    persist();

    if (location.hash.slice(2) !== id) {
      history.replaceState(null, '', `#/${id}`);
    }
    el.back.hidden = save.trail.length === 0;

    await veil(false);
  } catch (err) {
    renderBroken(id, err);
    await veil(false);
  } finally {
    navigating = false;
    armIdleHint();
  }
}

function veil(closed) {
  el.veil.classList.toggle('closed', closed);
  const ms = prefersReducedMotion() ? 0 : 700;
  return new Promise((r) => setTimeout(r, ms));
}

const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---- Rendering -------------------------------------------------------- */

function render(scene) {
  el.scene.innerHTML = scene.svg;
  el.scene.setAttribute('aria-label', scene.title || scene.id);

  const svg = el.scene.querySelector('svg');
  if (!svg) throw new Error(`artwork for "${scene.id}" contains no <svg> root`);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

  for (const spot of scene.hotspots || []) bind(svg, scene, spot);

  show(el.title, scene.title);
  show(el.caption, scene.caption);
  hideToast();
}

/* Titles and captions are an entrance, not furniture. They withdraw so the
 * picture is unobstructed — otherwise anything drawn low in a scene ends up
 * competing with prose for the same pixels. */
const PROSE_MS = 7000;
const proseTimers = new WeakMap();

function show(node, text) {
  clearTimeout(proseTimers.get(node));
  node.classList.remove('shown');
  if (!text) {
    node.textContent = '';
    return;
  }
  node.textContent = text;
  requestAnimationFrame(() => node.classList.add('shown'));
  proseTimers.set(node, setTimeout(() => node.classList.remove('shown'), PROSE_MS));
}

function renderBroken(id, err) {
  console.error(`[infinite-doors] ${id}:`, err);
  el.scene.innerHTML = `
    <div class="broken">
      <h2>This door does not open</h2>
      <p>Scene <strong>${escapeHtml(id)}</strong> failed to load.</p>
      <p>${escapeHtml(err.message)}</p>
      <p>The world is built by an unattended job; this is a bug, not a puzzle.</p>
    </div>`;
  show(el.title, '');
  show(el.caption, '');
}

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---- Hotspots --------------------------------------------------------- */

function bind(svg, scene, spot) {
  const id = String(spot.shape || '').replace(/^#/, '');
  const node = id && svg.querySelector(`#${CSS.escape(id)}`);

  if (!node) {
    // Validation catches this before merge; if it reaches a player, say so.
    console.warn(`[infinite-doors] ${scene.id}: no element "${spot.shape}"`);
    return;
  }

  if (spot.requires && !hasFlag(spot.requires)) return;

  const key = `${scene.id}:${id}`;
  const spent = spot.once && save.fired.includes(key);

  node.classList.add('hotspot');
  if (spent) node.classList.add('spent');
  node.setAttribute('tabindex', '0');
  node.setAttribute('role', 'button');
  node.setAttribute('aria-label', spot.label || describe(spot));

  const fire = (ev) => {
    ev.preventDefault();
    if (navigating) return;
    if (spot.once && save.fired.includes(key)) return;
    act(scene, spot, node, key);
  };

  node.addEventListener('click', fire);
  node.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' || ev.key === ' ') fire(ev);
  });
}

function describe(spot) {
  if (spot.action === 'goto') return `Go to ${spot.target}`;
  if (spot.action === 'frontier') return 'A door that does not open yet';
  return 'Something to look at';
}

function act(scene, spot, node, key) {
  clearTimeout(idleTimer);
  document.body.classList.remove('hinting');

  if (spot.sets) setFlag(spot.sets);
  if (spot.once) {
    markFired(key);
    node.classList.add('spent');
  }

  // Every scene names its air; a click may name its own reply. Doors get a
  // default voice either way.
  const sound = spot.sound
    || (spot.action === 'goto' ? 'door-pass' : null)
    || (spot.action === 'frontier' ? 'door-shut' : null);
  if (sound) audio.play(sound);

  switch (spot.action) {
    case 'goto':
      goto(spot.target);
      return;

    case 'animate':
      play(node, spot);
      if (spot.text) toast(spot.text);
      break;

    case 'text':
      toast(spot.text);
      break;

    case 'frontier':
      toast(spot.text || 'Locked. Something is behind it, but not yet.');
      break;

    default:
      console.warn(`[infinite-doors] unknown action "${spot.action}"`);
  }

  armIdleHint();
}

function play(node, spot) {
  const svg = node.ownerSVGElement || node;
  const target = spot.clipTarget
    ? svg.querySelector(`#${CSS.escape(spot.clipTarget)}`) || node
    : node;

  // Restart the animation even if the class is already present.
  target.classList.remove(spot.clip);
  void target.getBoundingClientRect();
  target.classList.add(spot.clip);

  if (!spot.once) {
    const ms = Number(spot.clipMs) || 2400;
    setTimeout(() => target.classList.remove(spot.clip), ms);
  }
}

/* ---- Toast ------------------------------------------------------------ */

function toast(text) {
  if (!text) return;
  clearTimeout(toastTimer);
  el.toast.textContent = text;
  el.toast.classList.add('shown');
  toastTimer = setTimeout(hideToast, Math.max(2600, text.length * 55));
}

function hideToast() {
  clearTimeout(toastTimer);
  el.toast.classList.remove('shown');
}

/* ---- Sound -------------------------------------------------------------
 *
 * Everything audible is synthesized from world/soundscape.json — a locked
 * palette of named patches, the exact discipline palette.json applies to
 * colour. Scenes name an ambience; hotspots may name a one-shot. Browsers
 * refuse audio before a user gesture, so the context is created on the
 * first pointer or key press — which in this game is also the first click
 * of play.
 */

const audio = (() => {
  let ctx = null;
  let master = null;
  let patches = {};
  let beds = [];            // currently sounding ambience
  let pending = [];         // ambience requested before the first gesture
  let error = null;
  const missing = new Set();

  function setPatches(p) { patches = p || {}; }

  function unlock() {
    if (ctx) return;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = save.muted ? 0 : 0.9;
      master.connect(ctx.destination);
      ambience(pending);
    } catch (err) {
      error = String(err && err.message || err);
    }
  }

  const now = () => ctx.currentTime;

  function noiseSource() {
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    return src;
  }

  function lfoInto(param, lfo, base) {
    if (!lfo) return null;
    const osc = ctx.createOscillator();
    const depth = ctx.createGain();
    osc.frequency.value = lfo.rate;
    depth.gain.value = lfo.depth;
    osc.connect(depth).connect(param);
    param.value = base;
    osc.start();
    return osc;
  }

  function startBed(name) {
    const p = patches[name];
    if (!p) { missing.add(name); return null; }

    const out = ctx.createGain();
    out.gain.setValueAtTime(0, now());
    out.gain.linearRampToValueAtTime(p.gain, now() + 1.4);
    out.connect(master);
    const stops = [];

    if (p.kind === 'drone') {
      for (const off of [0, p.detune || 0]) {
        const osc = ctx.createOscillator();
        osc.type = p.wave || 'sine';
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = p.filter || 800;
        const l = lfoInto(osc.frequency, off === 0 ? p.lfo : null, p.freq + off);
        osc.frequency.value = p.freq + off;
        osc.connect(filter).connect(out);
        osc.start();
        stops.push(osc, l);
      }
    } else if (p.kind === 'noise') {
      const src = noiseSource();
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.Q.value = p.q || 1;
      const l = lfoInto(filter.frequency, p.lfo, p.filter);
      filter.frequency.value = p.filter;
      src.connect(filter).connect(out);
      src.start();
      stops.push(src, l);
    } else {
      return null; // one-shots are not beds
    }

    return { name, out, stops: stops.filter(Boolean) };
  }

  function ambience(names) {
    const want = (names || []).slice(0, 2);
    if (!ctx) { pending = want; return; }

    for (const bed of beds) {
      bed.out.gain.linearRampToValueAtTime(0, now() + 0.9);
      const dead = bed;
      setTimeout(() => dead.stops.forEach((n) => { try { n.stop(); } catch {} }), 1100);
    }
    beds = want.map(startBed).filter(Boolean);
  }

  function play(name) {
    if (!ctx || save.muted) return;
    const p = patches[name];
    if (!p) { missing.add(name); return; }
    const t = now();

    if (p.kind === 'blip') {
      const osc = ctx.createOscillator();
      osc.type = p.wave || 'sine';
      osc.frequency.setValueAtTime(p.freq, t);
      if (p.fall) osc.frequency.exponentialRampToValueAtTime(p.fall, t + p.decay);
      const env = ctx.createGain();
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(p.gain, t + (p.attack || 0.005));
      env.gain.exponentialRampToValueAtTime(0.0005, t + p.decay);
      osc.connect(env).connect(master);
      osc.start(t);
      osc.stop(t + p.decay + 0.1);
    } else if (p.kind === 'swell') {
      const src = noiseSource();
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = p.filter || 600;
      const env = ctx.createGain();
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(p.gain, t + (p.rise || 0.2));
      env.gain.exponentialRampToValueAtTime(0.0005, t + (p.rise || 0.2) + (p.decay || 0.8));
      src.connect(filter).connect(env).connect(master);
      src.start(t);
      src.stop(t + (p.rise || 0.2) + (p.decay || 0.8) + 0.1);
      if (p.thump) {
        const osc = ctx.createOscillator();
        osc.frequency.value = p.thump;
        const tenv = ctx.createGain();
        tenv.gain.setValueAtTime(0, t);
        tenv.gain.linearRampToValueAtTime(p.gain * 0.9, t + 0.02);
        tenv.gain.exponentialRampToValueAtTime(0.0005, t + 0.7);
        osc.connect(tenv).connect(master);
        osc.start(t);
        osc.stop(t + 0.8);
      }
    }
  }

  function setMuted(m) {
    save.muted = m;
    persist();
    if (ctx) master.gain.linearRampToValueAtTime(m ? 0 : 0.9, now() + 0.2);
  }

  return {
    setPatches, unlock, ambience, play, setMuted,
    get diag() {
      return {
        ready: Boolean(ctx),
        state: ctx ? ctx.state : 'none',
        patches: Object.keys(patches).length,
        missing: [...missing],
        error,
      };
    },
  };
})();

function paintMute() {
  el.mute.textContent = save.muted ? '♪̸' : '♪';
  el.mute.setAttribute('aria-pressed', String(save.muted));
  el.mute.title = save.muted ? 'Unmute (M)' : 'Mute (M)';
}

/* ---- Hints ------------------------------------------------------------ */

function reveal() {
  document.body.classList.remove('hinting');
  void document.body.offsetWidth;
  document.body.classList.add('hinting');
  setTimeout(() => document.body.classList.remove('hinting'), 3400);
}

function armIdleHint() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(reveal, IDLE_HINT_MS);
}

/* ---- Navigation ------------------------------------------------------- */

function back() {
  const previous = save.trail.pop();
  persist();
  if (previous) goto(previous, { record: false });
  el.back.hidden = save.trail.length === 0;
}

el.back.addEventListener('click', back);
el.hint.addEventListener('click', reveal);
el.mute.addEventListener('click', () => { audio.setMuted(!save.muted); paintMute(); });

document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Backspace') { ev.preventDefault(); back(); }
  if (ev.key === 'h' || ev.key === 'H') reveal();
  if (ev.key === 'm' || ev.key === 'M') { audio.setMuted(!save.muted); paintMute(); }
});

// Browsers keep audio locked until a real gesture; the first click of play
// is that gesture.
['pointerdown', 'keydown'].forEach((evt) =>
  document.addEventListener(evt, () => audio.unlock(), { once: false, passive: true }));

window.addEventListener('hashchange', () => {
  const id = location.hash.slice(2);
  if (id && (!current || id !== current.id)) goto(id);
});

['pointerdown', 'keydown'].forEach((evt) =>
  document.addEventListener(evt, armIdleHint, { passive: true }));

/* ---- Boot ------------------------------------------------------------- */

el.back.hidden = save.trail.length === 0;
paintMute();

fetch('world/soundscape.json', { cache: 'no-cache' })
  .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`soundscape ${r.status}`))))
  .then((data) => audio.setPatches(data.patches))
  .catch((err) => console.warn('[infinite-doors] soundscape failed to load:', err.message));

goto(location.hash.slice(2) || ENTRY, { record: false });

// Exposed for tools/smoke.mjs.
window.__doors = {
  get current() { return current && current.id; },
  get busy() { return navigating; },
  get audio() { return audio.diag; },
  goto,
  save,
};
