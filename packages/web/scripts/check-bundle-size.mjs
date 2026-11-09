// Bundle-size gate (docs/web-client-rewrite.md §4.1). Runs after `vite build` and fails the
// build when a route's load closure exceeds its gzip budget.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { gzipSync } from 'node:zlib';

const distDirectory = path.resolve(import.meta.dirname, '../dist');
const manifest = JSON.parse(readFileSync(path.join(distDirectory, '.vite/manifest.json'), 'utf8'));

const KIB = 1024;
const STARTUP_ENTRY = 'index.html';

/**
 * Each budget names the manifest entries a user loads for that step. A budget with
 * `beyondStartup` counts only what the step adds on top of the start-up closure.
 */
const BUDGETS = [
  {
    name: 'home (start-up to interactive home)',
    entries: [STARTUP_ENTRY, 'src/routes/home/HomePage.tsx'],
    maxGzipBytes: 280 * KIB,
  },
  {
    // PixiJS loads its browser extensions and the selected renderer as dynamic chunks; the stage
    // always requests WebGL, so that renderer counts and the WebGPU / Canvas ones do not. The
    // room seat board's scene chunk (decoration specs) loads with it.
    name: 'scene layer (PixiJS stage + WebGL renderer + seat decorations)',
    entries: [
      'src/scene/stage.ts',
      'src/features/room/components/RoomSeatScene.tsx',
      '../../node_modules/pixi.js/lib/environment-browser/browserAll.mjs',
      '../../node_modules/pixi.js/lib/rendering/renderers/gl/WebGLRenderer.mjs',
    ],
    beyondStartup: true,
    maxGzipBytes: 180 * KIB,
  },
  {
    name: 'Sentry Session Replay (lazy)',
    entries: ['src/sentryReplay.ts'],
    beyondStartup: true,
    maxGzipBytes: 52 * KIB,
  },
];

/**
 * The manifest key of a budget entry. A module that Rolldown hoisted into a shared chunk is no
 * longer keyed by its path; that chunk carries the module's file name as its `name`.
 */
function resolveManifestKey(entry) {
  if (manifest[entry]) return entry;
  const moduleName = path.basename(entry).replace(/\.[^.]+$/, '');
  const keys = Object.keys(manifest).filter(
    (key) => key.startsWith('_') && manifest[key].name === moduleName,
  );
  if (keys.length !== 1) {
    throw new Error(`Bundle budget names "${entry}", which is not in the Vite manifest`);
  }
  return keys[0];
}

/** Collects the emitted files a manifest entry loads synchronously: its chunk, static imports and CSS. */
function collectLoadClosure(entryKey, files = new Set(), visited = new Set()) {
  if (visited.has(entryKey)) return files;
  visited.add(entryKey);
  const chunk = manifest[entryKey];
  if (!chunk) {
    throw new Error(`Bundle budget names "${entryKey}", which is not in the Vite manifest`);
  }
  files.add(chunk.file);
  for (const cssFile of chunk.css ?? []) files.add(cssFile);
  for (const importedKey of chunk.imports ?? []) collectLoadClosure(importedKey, files, visited);
  return files;
}

function gzipSize(file) {
  return gzipSync(readFileSync(path.join(distDirectory, file))).length;
}

const startupFiles = collectLoadClosure(STARTUP_ENTRY);
const failures = [];

for (const budget of BUDGETS) {
  const files = new Set();
  for (const entry of budget.entries) collectLoadClosure(resolveManifestKey(entry), files);
  const counted = [...files].filter((file) => !(budget.beyondStartup && startupFiles.has(file)));
  const totalBytes = counted.reduce((sum, file) => sum + gzipSize(file), 0);
  const line = `${budget.name}: ${(totalBytes / KIB).toFixed(1)} KiB / ${budget.maxGzipBytes / KIB} KiB gzip`;
  process.stdout.write(`${line}\n`);
  if (totalBytes > budget.maxGzipBytes) failures.push(line);
}

if (failures.length > 0) {
  process.stderr.write(`Bundle budget exceeded:\n${failures.join('\n')}\n`);
  process.exit(1);
}
