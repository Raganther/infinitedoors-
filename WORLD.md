# WORLD.md — what has been built

Newest first. Every growth run prepends one entry. This is the world's diary
and the fastest way for a future run to see where it has been.

---

## 2026-07-28 — EXPAND

Opened **the treeline** out of the field into `wood-path`: the first room of
the wood region. A path that was agreed rather than worn, one shaft of moon
through the canopy, and at the end of it a green glow between the trunks that
stays the same distance away no matter how far you walk toward it.

A lantern somebody keeps fed. A pale thing between the far trunks that only
moves during the moment of a click. And for players who met the shape in the
field's grass, the other mouth of its burrow — combed flat in both directions.

Left one big frontier: the clearing, round and mown and deliberate, meant to
become the hub the rest of the wood hangs off. Craft 3 at birth — layered but
not yet alive — so the ladder has honest work left here.

Housekeeping note: today's scheduled firing died of an account usage limit
mid-run (the workspace pool, not this world's checks — a concept fan-out an
hour later got "session limit resets 4:20pm UTC" in as many words). This
cycle was run by hand in the main session instead, following GROW.md as
written. The smoke test also gained a real cold-start: scene-to-scene hash
navigation was leaking flags between scenes' tests.

Scenes: 4 (+1) · Frontiers: 9 (±0: opened one, left one) · Craft: 3.5

---

## 2026-07-28 — REPAIR

The first scheduled run fired and built nothing. Cause was in this file's
sibling: `GROW.md` step 0 told the run to `npm install`, which drops a second
playwright next to the working one already in the environment. That copy hunts
for a browser build number that is not on disk, the smoke test dies with
"Executable doesn't exist", and a red check sends the run into REPAIR — where
it could not fix a browser mismatch and gave up. Silently.

Three things changed:

- `tools/browser.mjs` finds a chromium that actually launches, falling back to
  whatever is installed rather than trusting the module's own expectation.
- `GROW.md` no longer says to install anything, and says why.
- The smoke test stopped clearing storage by reloading mid-load, which aborted
  the engine's in-flight fetch and produced an occasional false failure. An
  intermittent red costs a day exactly like a real one does.

Verified by cloning the world fresh, reproducing the break, and then running
the checks five times against the still-broken install.

Scenes: 3 · Frontiers: 9 · Craft: 3.67

---

## 2026-07-27 — MECHANIC

Added the craft ladder, so the drawing improves as steadily as the world
grows. Every scene now carries a `craft` level from 2 to 5 — blocked in and
lit, layered, alive, inhabited — and a new ENRICH run raises exactly one
scene by exactly one rung.

It is a ratchet on purpose. `manifest.nextEnrich` names the scene and the
rung, so there is never a judgement call about what to polish next, and no
scene can be revisited until the rest of the world has caught up. Without
that, an unattended polish loop redraws the same room forever.

Rung 4 is checked rather than claimed: a scene asserting it must really have
ambient motion in its artwork and must really honour `prefers-reduced-motion`.

Seeded honestly — the hall and the landing at 4, the hold at 3, which makes
the hold the first thing the world will redraw.

Scenes: 3 · Frontiers: 9 · Craft: 3.67

---

## 2026-07-27 — SEED

The world begins with three places and nine shut doors.

**`hall-of-doors`** — a corridor with no visible end, lit by one swinging
lamp. Six doors that do not open: warm, over-hinged, ajar and breathing,
handleless, knee-high, and the one at the end that stays the same distance
away. One door does open.

**`field-landing`** — dusk, a craft at rest above a field, and the door you
came through still standing in the grass behind you. The treeline is closer
each time you look.

**`ship-hold`** — inside. Specimen jars along one wall, one of them occupied
and awake now. A console that asks a question you cannot answer, and
unlatches something above you when you fail.

Also laid down: the engine, the scene grammar, the locked palette, and the
three checks that stand in for a reviewer — data validation, a browser
play-through of every hotspot, and the rule that the world must always keep
at least three unopened doors.

Scenes: 3 · Frontiers: 9
