# Bahía Sol

[![make.fun gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/lhwnb/bahia-sol/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/lhwnb/bahia-sol/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Bahía Sol is a third-person open-world crime game that lives entirely inside `game/`. A fictional
sun-bleached coastal city — downtown glass towers, a marina with docks, a palm-lined beach strip and
a warehouse quarter — is generated from code. No images, models or audio files are loaded: every
texture is painted onto a canvas at start-up, every sound is synthesised by WebAudio, and the only
vendored library is three.js (`game/vendor/three.min.js`).

You arrive with a phone, a pistol and a debt. Three jobs from three people take you from a marina
car theft, through a police-pressured delivery run, to a warehouse full of rivals. Between jobs the
city is yours: steal cars, run from the policía, or just drive the coast road at sunset.

## Controls

| Input | Action |
| --- | --- |
| `W A S D` | Walk / drive, steer |
| `Shift` | Sprint / handbrake |
| `Mouse` | Look (click the canvas to capture the pointer) |
| `Left mouse` | Fire the equipped weapon |
| `E` | Enter or leave a car, carjack a traffic car |
| `1` / `2` | Pistol / SMG |
| `Q` | Punch when unarmed |
| `M` | Mute audio |
| `Esc` | Pause menu / resume |
| `R` | Restart after being wasted or busted |

## Running it

```sh
node serve.ts                       # static server for game/ on http://localhost:8080
MAKEFUN_OUTPUT_DIR=out node main.ts # copy game/ + screenshots/ into out/ and write dossier.json
```

`main.ts` is the graded entrypoint. It mirrors the two folders into the output directory
(`/output` by default, or `MAKEFUN_OUTPUT_DIR`), then writes `dossier.json` through
`vendor/makefun-game.ts`. `vendor/makefun-game.ts` is never modified.

## Screenshot mode

Appending `?shot=cover`, `?shot=foot`, `?shot=mission` or `?shot=night` to `index.html` builds a
deterministic staged scene at 1280×720 with the normal HUD, renders it with a seeded RNG and no
clock reads, and sets `window.__ready = true` once it has drawn at least eight frames. The four
frames in `screenshots/` come from that mode — `1-cover.jpg` (the cover), `2-street.jpg`,
`3-mission.jpg`, `4-night.jpg` — each 1280×720 and under 256 KiB. The first by name is the cover.

## Where things live

```
game/index.html            page, HUD overlay markup, classic script tags
game/src/config.js         palette, vehicle and weapon specs, mission table, city rules
game/src/rng.js            seeded PRNG shared by the world and the screenshot stages
game/src/input.js          keyboard/mouse state and pointer lock
game/src/textures.js       canvas-painted asphalt, facades, neon, sand, glow sprites
game/src/city.js           road grid, blocks, buildings, props, palms, ocean, sky, lights
game/src/vehicles.js       car factory, arcade physics, damage, carjacking
game/src/traffic.js        lane graph and ~30 NPC cars
game/src/pedestrians.js    ~50 walkers with limbs, panic and scatter
game/src/player.js         on-foot controller, camera rig, health and armour
game/src/combat.js         pistol/SMG, raycast hits, tracers, muzzle flash, pickups
game/src/police.js         wanted stars, cruiser AI, sirens, roadblocks
game/src/missions.js       three story jobs, markers, timers, payout, epilogue
game/src/hud.js            DOM HUD and the minimap canvas
game/src/audio.js          WebAudio engine, siren, guns, footsteps, surf
game/src/saves.js          localStorage save/load
game/src/shots.js          the four staged screenshot presets
game/src/main.js           bootstrap, game loop, mode routing
game/vendor/three.min.js   three.js r158, vendored and unmodified
```

Everything is plain classic scripts loaded in dependency order from `index.html`; there are no ES
module imports in the game code and no network requests at runtime.

<sub>Entered on [make.fun](https://make.fun/?ref=7d4kyrhq&utm_source=github&utm_medium=repo&utm_campaign=gta6-01).</sub>
