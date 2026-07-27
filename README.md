# Infinite Doors

A click-and-play world. You click something in the picture and it opens
somewhere new, or it moves, or it tells you something you would rather not
know.

Nobody builds it by hand. A scheduled job opens one door a day.

```bash
npm install
npx playwright install chromium
npm run serve          # http://127.0.0.1:8080
```

---

## How it grows

Every scene leaves at least one **frontier** — a door that is drawn but does
not open yet, carrying a note about what might be behind it. Those notes are
the queue. Each day the job reads the world, picks a frontier, and builds the
place behind it, leaving new frontiers as it goes. Unbuilt world grows faster
than built world, so it never runs out of anywhere to go.

Runs vary so the world gains depth and not just square footage:

| | |
| --- | --- |
| **Expand** | Open a frontier door, build the room behind it |
| **Deepen** | Add interactions to somewhere that already exists |
| **Weave** | Connect two distant regions — turn the tree into a graph |
| **Curate** | Weekly. No new content; fix drift, prune, improve |
| **Mechanic** | Monthly. Add a new verb: an item, a memory, a lock |
| **Repair** | The build is red. Fix it, build nothing. |

The rules live in [`GROW.md`](GROW.md). The look and the voice live in
[`STYLE.md`](STYLE.md). What has been built so far is in
[`WORLD.md`](WORLD.md).

## How it stays coherent

Nobody reviews the job's work at 3am, so the checks do:

```bash
npm run check
```

- **Data** — every hotspot points at a shape that exists in the artwork, every
  exit at a scene that exists, no orphans, no unreachable rooms, no gate whose
  key is never granted, no scene without a way out.
- **Palette** — every colour in every scene must be in
  [`world/palette.json`](world/palette.json). This is the strongest guard
  against the world drifting into four hundred different styles.
- **Play** — a real browser opens every scene and clicks every hotspot,
  proving the doors actually work and that nothing invisible is sitting on top
  of them swallowing clicks.
- **Growth** — the world must always keep at least three unopened doors. A run
  that eats its own future fails.

## Under the hood

Vanilla JavaScript, hand-authored SVG, no build step, no runtime dependencies.
The whole thing is static files, which is the point: there is nothing to
break at 3am on a Sunday, and the artwork is text that diffs cleanly.

Scenes are data — a `.json` describing what is clickable and an `.svg` holding
the drawing. Hotspots reference ids *inside* the SVG, so the clickable region
is the drawn object itself. `game/engine.js` is deliberately small and rarely
changes.

```
world/scenes/ship-hold.json    what is clickable, and what it does
world/scenes/ship-hold.svg     the drawing; ids are the click targets
```

## Publishing

The site deploys to GitHub Pages on every green push to `main`. The workflow
turns Pages on itself the first time it runs — there is nothing to click.
