# Infinite Doors

A click-and-play world. You click a thing in the picture; it opens somewhere
new, or it moves, or it tells you something. The world is grown by a scheduled
job, one increment at a time.

## If you are the scheduled growth job

Read **`GROW.md`** and do exactly one growth cycle. Everything you need is
there. Do not start from this file.

## Layout

```
index.html            the shell
game/engine.js        loads scenes, binds hotspots, runs transitions
game/style.css        frame, hotspot affordances, prose
world/palette.json    the locked palette — validator enforces it
world/soundscape.json the locked sound palette — synthesized, no audio files
world/schema.json     the scene grammar
world/manifest.json   generated; the world's state and frontier queue
world/scenes/*.json   one per scene: hotspots and what they do
world/scenes/*.svg    one per scene: the artwork, ids are click targets
tools/                manifest builder, validator, browser smoke test, shots
```

## Commands

```bash
npm run check      # manifest + validate + smoke. Must be green to commit.
npm run serve      # play it at http://127.0.0.1:8080
node tools/shot.mjs [scene-id] [--raw]
```

Playwright is needed for the smoke test and screenshots:
`npm i -D playwright && npx playwright install chromium`.

## The two rules that matter

**Grow by adding data, not by editing the engine.** Scenes are `.json` +
`.svg`. `game/engine.js` changes only on a deliberate MECHANIC run, with
`world/schema.json` and `tools/validate.mjs` updated in the same commit.

**Leave the checks green.** Nobody reviews the growth job's diffs. `npm run
check` is the only reviewer this world has, so a red build blocks every future
run until someone repairs it.

## Conventions

- No build step, no framework, no runtime dependencies. It is served as files.
- `STYLE.md` governs everything visual and every line of prose. It is binding.
- Colours come from `world/palette.json` and nowhere else.
- Every scene keeps at least one `frontier` hotspot — a door drawn but not yet
  opened, carrying a `hint` for whoever builds it. That queue is what lets the
  world keep growing without anyone inventing from nothing.
