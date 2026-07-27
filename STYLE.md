# STYLE.md — the rules of the picture

Binding on every run. Only a CURATE run may change this file.

Hundreds of unattended runs will touch this world. Without a fixed style it
becomes a scrapbook by four hundred different people. These rules are what
makes it feel like one place.

---

## The palette

`world/palette.json` is the single source of truth and the validator enforces
it. Every colour in every scene must be one of these. No exceptions, no
"just this once".

| | | |
| --- | --- | --- |
| `abyss` | `#05040a` | Deepest shadow, silhouettes, vignette |
| `ink` | `#0d0b14` | Night, unlit surfaces |
| `umbra` | `#1b1729` | Shadowed mass |
| `mauve` | `#3b3050` | The default lit surface |
| `heather` | `#544266` | A step brighter |
| `dust` | `#6b5f7a` | Frames, edges, structure |
| `haze` | `#9a8fa8` | Distance, fog, faded detail |
| `bone` | `#d8d0c4` | Highlights, paper, bone |
| `parchment` | `#f0e9dd` | The brightest thing available |
| `lamp` | `#f2c46b` | Warm light. Where the player should look. |
| `ember` | `#d97757` | Warmth, dusk, alarm |
| `rust` | `#8f4a3c` | Dried warmth, old blood, sunset ground |
| `verdigris` | `#6fb3a0` | Cold light. Alien, electric, wrong. |
| `deep-teal` | `#2a4d4d` | Cold shadow, water, vegetation |

Get variety from **opacity, gradients and layering**, not new hex values. Two
palette colours at different opacities over a third will give you almost
anything you need.

**Warm means safe or human. Cold green means other.** Keep that reading
consistent — it is doing quiet work across the whole world.

---

## The frame

- `viewBox="0 0 1600 900"`, always. Scenes must cut together.
- Include a `<title>` describing the scene. Screen readers use it.
- **Safe area for hotspots: x 80–1520, y 90–740.** Below y 740 is where
  prose appears on entry; the top right corner holds the controls. Anything
  important outside that box will be sat on.
- One dominant light source per scene, and put it where you want the player
  to look first.
- End with a vignette rect carrying `pointer-events="none"`. It holds the
  whole world together tonally.

---

## Making things clickable

The drawn object **is** the click target. Never lay an invisible rectangle
over the artwork — that is how you get a world that hovers wrong and reads
as a slideshow with hidden buttons.

Two rules the smoke test enforces, both learned the hard way:

1. **Anything drawn above a hotspot needs `pointer-events="none"`** — glows,
   light cones, dust, weather, vignettes. Otherwise it silently swallows the
   click and the door simply stops working.
2. **A hotspot group must be solid at the centre of its bounding box.** A
   ring, an arch, or a scatter of separate shapes has a hole in the middle
   where clicks fall through. Give it a backing shape — usually one that
   improves the picture anyway.

Give hotspots room. Two adjacent doors should not share an edge.

---

## Drawing

Work in **silhouette first**. This world reads as shape and light, not
detail. If the composition does not work in flat black against the sky, more
detail will not save it.

- Build depth with **layers**: a near-black foreground mass, a mid-tone
  subject, a lighter background. Three planes is usually enough.
- Perspective is welcome but must be consistent within a scene. If you use a
  vanishing point, put everything on it.
- Gradients do the atmospheric work. Flat fills read as clip art.
- Prefer 40 considered shapes to 400 automatic ones. The budget is 90kB per
  scene and you should not come close.
- Faces are almost always a mistake. Two dots in the dark do more.

---

## Movement

- CSS `@keyframes` inside the SVG's own `<style>` block.
- **Prefix every animation name with the scene id** (`field-twinkle`, not
  `twinkle`) — scenes share a document and unprefixed names will collide.
- Triggered animations run 1.5–3.5s and resolve. Set `clipMs` to match.
- Ambient loops (dust, stars, breathing) must be slow, low-contrast, and
  wrapped in `@media (prefers-reduced-motion: reduce)`.
- Movement should answer the click, not decorate it. A thing that turns to
  look at you beats a thing that sparkles.

---

## Words

Second person, present tense. Understated. The horror and the comedy are both
in the flatness.

- **Captions** set the scene in one line. They fade after seven seconds.
- **Hotspot text** is the reward for a click. One or two sentences. It should
  tell the player something true they did not want to know.
- **Never explain the puzzle.** Never say "you can click this". Never wink at
  the player about being in a game.
- **Titles** are lowercase, under 40 characters: `the hall of doors`,
  `the hold`, `somewhere under the seabed`.
- **Frontier text** is what the player gets for trying a door that does not
  open yet. It must read as a deliberate refusal, never as missing content.

Good: *The grass moves against the wind. Whatever was there is nearer now.*

Bad: *Wow, spooky! Something's in the grass — but you can't reach it yet.*

---

## Naming

- Scene ids are kebab-case and describe the place: `ship-hold`,
  `folding-room`. Never `scene-14`.
- Element ids describe the object: `door-warm`, `jar-tall`, `hatch-floor`.
- Region names group scenes loosely: `hall`, `field`, `ship`.
- Flags are lowercase and read as facts: `saw-the-sleeper`, `console-run`.

---

## The shape of the world

- The hall is the hub and always reachable. It should stay unsettling and
  mostly shut.
- Regions have a character and hold it. Do not put a spaceship console in the
  seabed because it was convenient.
- Prefer **depth over breadth**: a region of four connected scenes beats four
  unrelated rooms hanging off the hall.
- Not every door should open. A world where everything is reachable is a menu.
