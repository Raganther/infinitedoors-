# GROW.md — one growth cycle

You are the scheduled job that builds this world. You have no memory of your
previous runs. Everything you know about the world is in this repository.

Read this file top to bottom, then do exactly one growth cycle and stop.

---

## 0. Orient

You work on **`main`**, always — never on whatever branch a fresh clone
happens to land on. Run these first, before changing anything:

```bash
git fetch origin main && git checkout -B main origin/main
npm run manifest && npm run validate     # fast, no browser
node tools/smoke.mjs                     # plays the world in a real browser
```

**Do not run `npm install` unless something actually reports a missing
module.** This world has no runtime dependencies. Your environment already has
a working browser, and installing a second playwright next to it gives you one
that hunts for a browser build number that is not on disk. That turns the
checks red, sends you into REPAIR, and costs the day. It has happened.

Then read, in this order:

| File | What it tells you |
| --- | --- |
| `world/manifest.json` | Every scene, every exit, and the **frontier queue** |
| `STYLE.md` | The locked palette and the rules of the picture. Binding. |
| `WORLD.md` | What previous runs did, most recent first |
| `world/schema.json` | The scene grammar |
| One existing scene `.json` + `.svg` | The standard you are matching |

**If the checks fail before you have touched anything, your run type is
REPAIR.** Fix what is broken, commit, push, stop. Build nothing new.

---

## 1. Choose your run type

Work down this list and take the **first** one that matches.

1. **REPAIR** — the checks failed on a clean tree.
2. **CURATE** — today is Sunday.
3. **MECHANIC** — today is the 1st of the month *and* there are ≥ 12 scenes.
4. **EXPAND** — fewer than 5 open frontiers.
5. **ENRICH** — some scene is below craft 3.
6. **DEEPEN** — some scene has fewer than 4 hotspots or fewer than 2 interactions.
7. **ENRICH** — `counts.craftMean` is below 3.5.
8. **WEAVE** — there are ≥ 8 scenes and the scene count is divisible by 5.
9. **EXPAND** — otherwise.

Say which one you picked, and why, in the commit message.

Rules 5 and 7 are what keep the drawing pacing with the building. Every new
scene arrives at craft 2 and drags `craftMean` down; every ENRICH run lifts it
back. So the world naturally alternates between growing and getting better
looking, without either being scheduled by hand.

---

## 2. The run types

### EXPAND — open a door

The default. One frontier becomes a real place.

1. Pick one entry from `manifest.frontier`. Prefer one whose `hint` genuinely
   interests you and whose region is under-built. Do not pick a frontier that
   its own hint says should stay shut.
2. Build **one** new scene behind it — two only if the first is genuinely
   small, and never at the cost of quality.
3. In the *parent* scene's JSON, change that hotspot from
   `"action": "frontier"` to `"action": "goto"` with `"target"` set to your new
   scene. Drop its `hint`; keep or improve its `label`.
4. The new scene must:
   - have **at least 4 hotspots**;
   - have **at least one `goto` back** to somewhere already reachable;
   - leave **at least one new `frontier`**, with a hint written for whoever
     builds next. This is not optional. It is how the world keeps growing;
   - be built to **craft 2** — composed, lit, vignetted — and say so in its
     JSON. Do not try to reach rung 5 in one sitting. Later ENRICH runs will
     take it the rest of the way, and they will do it better than a run that
     is also inventing a place from scratch.

### DEEPEN — reward a second look

No new scenes. Take the thinnest existing scene and make it worth standing in.

Add interactions to the artwork: things that move, respond, or say something.
Two to four new hotspots. Consider a `sets` flag and a `requires` gate so the
scene changes once the player has understood something. Add drawing where the
scene is visually bare.

### ENRICH — draw one scene better

No new scenes, no new hotspots, no new prose. One scene's artwork goes up
exactly one rung on the craft ladder in `STYLE.md`.

`manifest.nextEnrich` has already chosen for you:

```json
"nextEnrich": { "scene": "ship-hold", "craft": 3, "raiseTo": 4 }
```

Take that scene. Read the rung you are raising it *to* — not the one above it
— and do that work and only that work. Then set `"craft"` in the scene JSON to
the new level.

What this means in practice:

- **→ 3 (layered)** — add a foreground mass that partly occludes the subject.
  Push the background back with haze. Make the three planes read distinctly.
- **→ 4 (alive)** — add ambient motion belonging to the place, slow and
  low-contrast, inside `@media (prefers-reduced-motion: reduce)`. The
  validator checks the artwork actually has an infinite animation, so you
  cannot bank the rung without doing it.
- **→ 5 (inhabited)** — add wear, residue, evidence. Something that says this
  place had a life before the player arrived. Hide one detail that only
  rewards a second visit.

Three things you must not do:

- **Do not re-stage the composition.** You are adding to a drawing, not
  redrawing it. If the composition is genuinely wrong, that is CURATE.
- **Do not touch hotspot ids or their geometry.** Every existing click target
  must survive untouched. `npm run check` will tell you if one stops working,
  but the point is not to break it in the first place.
- **Do not skip a rung** to get somewhere more interesting.

Afterwards, look at it — `node tools/shot.mjs <scene-id>`. If it is not
visibly better than it was, you have not finished the run.

### WEAVE — connect what is already there

No new scenes. Take two scenes in **different regions** that are currently far
apart in the graph, and connect them — through a frontier if one fits, or by
drawing a new way through into an existing scene.

This is what stops the world being a tree of dead ends. A player who finds a
shortcut between two distant places feels like they discovered something,
because they did.

### CURATE — pay down the drift

No new content at all. Choose the two or three that matter most:

- Bring scenes that have drifted back onto the palette and the style rules.
- Rewrite prose that has gone florid, jokey, or explanatory.
- Improve the weakest artwork in the world.
- Delete or rework anything that is bad. You are allowed to remove things.
- Tighten `STYLE.md`, or amend the palette if the world has genuinely
  outgrown it. **This is the only run type that may change the palette**, and
  if you do, update every scene that needs it in the same commit.
- Rewrite `GROW.md` itself if the process has a flaw. It is meant to improve.

### MECHANIC — add a verb

Rare, and the only run type that may change `game/engine.js`.

Introduce one new thing the player can *do* — an object carried between
scenes, a state that persists, a door that needs something first. Small and
complete beats large and half-wired.

Requirements:
- Extend `world/schema.json`, `game/engine.js`, and `tools/validate.mjs`
  **together**. A grammar the validator does not check will rot.
- Every existing scene must keep working unchanged.
- Use the new verb in at least one scene, so it is not theoretical.
- Write a short section in `STYLE.md` on when to reach for it.

### REPAIR — get back to green

Fix the failure and nothing else. Do not build while the world is broken. If
you cannot fix it, revert the commit that caused it and say so in `WORLD.md`.

---

## 3. Rules that always apply

- **The palette is locked.** Every colour must be in `world/palette.json`.
  Only a CURATE run may change that file.
- **Never break a link.** Removing or renaming a scene means fixing everything
  that points at it.
- **Never strand a player.** Every scene needs a way onward that is not the
  back button.
- **The world must always have ≥ 3 open frontiers.** The validator enforces
  this. If a run leaves the world with fewer, it has eaten its own future.
- **The engine is not yours to edit** except on a MECHANIC run.
- **Draw, don't decorate.** A new scene with four hotspots and flat artwork is
  worse than one with four hotspots that is genuinely nice to look at.
- **Leave the checks green.** A red build blocks every future run.

---

## 4. Building a scene

1. **Decide what the place is** before you draw. The hint is a seed, not a
   specification — the interesting version is usually one step stranger than
   the obvious reading.
2. **Write the SVG** — `world/scenes/<id>.svg`. Follow `STYLE.md` exactly on
   viewBox, palette, safe area, and pointer-events. Give every interactive
   thing an `id`. Put animation keyframes in a `<style>` block, prefixed with
   the scene id so they cannot collide.
3. **Write the JSON** — `world/scenes/<id>.json`, matching `world/schema.json`.
4. **Link it in** by converting the parent frontier to a `goto`.
5. **Check your work:**
   ```bash
   npm run check
   ```
   This regenerates the manifest, validates the data, and plays the whole
   world in a browser. All three must pass.
6. **Look at it.** Take a screenshot and actually look:
   ```bash
   node tools/shot.mjs <scene-id>
   ```
   If it is ugly, fix it. The validator cannot see.

---

## 5. Finish

Prepend an entry to `WORLD.md`:

```markdown
## YYYY-MM-DD — EXPAND

Opened **the door with too many hinges** into `folding-room`, where the walls
do not agree about how many corners the room has. Left two frontiers: the
folded corner, and the thing behind the wallpaper.

Scenes: 12 (+1) · Frontiers: 9 (+1)
```

Then commit and push:

```bash
git add -A
git commit -m "EXPAND: the folding room, behind the door with too many hinges"
git push -u origin main
```

Push to `main`. CI runs the same checks; if it goes red, the next run's REPAIR
rule will catch it, but you should not be the reason.

---

## 6. Budget

One cycle is roughly:

| | |
| --- | --- |
| New scenes | 1, occasionally 2 |
| New hotspots | 4–8 |
| Files touched | under 6 |
| Engine changes | none, unless MECHANIC |

If you find yourself rewriting large parts of the world, stop. That is a
CURATE run, and it should be its own cycle.

**Do one cycle. Then stop.** The next run is tomorrow.
