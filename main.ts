// Bahía Sol — bounty entry for make.fun "gta6-01".
//
// What ships:
//   game/         index.html + classic src/*.js + vendored three.js (nothing else is loaded)
//   screenshots/  1-cover.jpg, 2-street.jpg, 3-mission.jpg, 4-night.jpg (cover sorts first)
//   vendor/       makefun-game.ts — the scorer's dossier builder, never edited here
//
// Running `node main.ts` mirrors game/ and screenshots/ into the target folder and
// writes dossier.json beside them. The grader mounts /output; locally override it:
//   MAKEFUN_OUTPUT_DIR=out node main.ts
//
// Standard-library Node only: no install step, no network, no build.

import { cp, mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const ROOT = dirname(fileURLToPath(import.meta.url));

/** Names and order the judge expects; the first file is the cover. */
const SHOT_ORDER = ['1-cover.jpg', '2-street.jpg', '3-mission.jpg', '4-night.jpg'];

/** Reference-gate limits handed to the dossier builder. */
const GATE = {
  text_max_bytes: 163_840,
  screenshots: { max: 4, max_bytes: 262_144 },
  game_max_files: 993,
  game_max_bytes: 50_331_648,
  game_path_max_bytes: 1_000,
};

function targetFolder(): string {
  const override = process.env.MAKEFUN_OUTPUT_DIR;
  if (override !== undefined && override.trim() !== '') return resolve(override.trim());
  return '/output';
}

async function walk(dir: string, base: string = dir): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(full, base)));
    else if (entry.isFile()) files.push(relative(base, full).split('\\').join('/'));
  }
  return files.sort();
}

/** Copy a folder and report how many files arrived, plus the largest path. */
async function mirror(source: string, destination: string): Promise<{ count: number; longest: number }> {
  await mkdir(destination, { recursive: true });
  await cp(source, destination, { recursive: true, force: true });
  const files = await walk(destination);
  let longest = 0;
  for (const file of files) longest = Math.max(longest, Buffer.byteLength(file, 'utf8'));
  return { count: files.length, longest };
}

/** Pre-flight the screenshot set exactly as the gate will see it. */
async function inspectShots(folder: string): Promise<{ lines: string[]; total: number }> {
  const lines: string[] = [];
  let total = 0;
  for (const name of SHOT_ORDER) {
    const path = join(folder, name);
    if (!existsSync(path)) {
      lines.push(`  ${name.padEnd(14)} MISSING`);
      continue;
    }
    const bytes = (await stat(path)).size;
    total += bytes;
    const verdict = bytes <= GATE.screenshots.max_bytes ? 'ok' : 'OVER LIMIT';
    lines.push(`  ${name.padEnd(14)} ${String(bytes).padStart(7)} B  ${verdict}`);
  }
  return { lines, total };
}

/** index.html must exist and stay inside its own cap. */
async function inspectEntry(gameDir: string): Promise<string> {
  const index = join(gameDir, 'index.html');
  if (!existsSync(index)) throw new Error(`missing ${index}`);
  const bytes = (await stat(index)).size;
  if (bytes > 1_048_576) throw new Error(`game/index.html is ${bytes} B, over 1 MiB`);
  const html = await readFile(index, 'utf8');
  if (!html.includes('src/main.js')) throw new Error('index.html does not load src/main.js');
  return `  index.html     ${String(bytes).padStart(7)} B  ok`;
}

async function run(): Promise<void> {
  const outDir = targetFolder();
  const gameSource = join(ROOT, 'game');
  const shotsSource = join(ROOT, 'screenshots');
  if (!existsSync(gameSource)) throw new Error(`no game/ next to ${basename(ROOT)}/main.ts`);

  const entryLine = await inspectEntry(gameSource);

  const game = await mirror(gameSource, join(outDir, 'game'));
  if (game.count > GATE.game_max_files) {
    throw new Error(`game/ has ${game.count} files, cap is ${GATE.game_max_files}`);
  }
  if (game.longest > GATE.game_path_max_bytes) {
    throw new Error(`a game path is ${game.longest} bytes, cap is ${GATE.game_path_max_bytes}`);
  }

  const shotsOut = join(outDir, 'screenshots');
  let shots = { count: 0, longest: 0 };
  if (existsSync(shotsSource)) shots = await mirror(shotsSource, shotsOut);
  if (shots.count !== SHOT_ORDER.length) {
    throw new Error(`screenshots/ holds ${shots.count} files, expected ${SHOT_ORDER.length}`);
  }

  const audit = await inspectShots(shotsOut);
  const dossier = buildDossier(outDir, GATE);
  await writeFile(join(outDir, 'dossier.json'), dossier);

  process.stdout.write([
    'Bahía Sol → ' + outDir,
    entryLine,
    `  game/          ${String(game.count).padStart(7)} files`,
    `  screenshots/   ${String(shots.count).padStart(7)} files, ${audit.total} B`,
    ...audit.lines,
    `  dossier.json   ${String(dossier.byteLength).padStart(7)} B`,
    '',
  ].join('\n'));
}

await run();
