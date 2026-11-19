# Bahía Sol

[![make.fun gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/lhwnb/bahia-sol/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

An open-world crime game that runs in a desktop browser from its own files: a sun-soaked coastal
city you cross on foot and by car, with traffic, pedestrians, a wanted level the policía answer,
three missions with a story, combat, a minimap and a save.

## Run it

```sh
node serve.ts   # serves game/ at http://localhost:8080
```

Play with keyboard and mouse: `WASD` to walk or drive, `Shift` to sprint, `E` to take or leave a
car, `Left mouse` to fire, `M` for the map, `Esc` for the menu. `R` restarts after a wipe.

To build the entry the way the grader does:

```sh
MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `game/` and `screenshots/` into the output directory and writes `dossier.json`
with `vendor/makefun-game.ts`, exactly as the kit's rules describe.

## What is in the box

- `game/index.html` — the page the browser opens, one canvas and the HUD.
- `game/src/` — the game's own source, one job a file: the city, traffic, pedestrians, vehicles,
  the player, combat, the policía, missions, the HUD, audio, saves and the screenshot presets.
- `game/vendor/three.min.js` — three.js, vendored, never shown as this game's source.
- `screenshots/` — four renders of the game's own code in Chrome; the first by name is the cover.
- `serve.ts` — a static file server for `game/`, for playing it locally.

<sub>Entered on [make.fun](https://make.fun/?ref=7d4kyrhq&utm_source=github&utm_medium=repo&utm_campaign=gta6-01).</sub>
