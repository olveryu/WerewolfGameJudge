// Bundle-size gate (docs/web-client-rewrite.md §4.1). Runs after `vite build` and fails the
// build when a route's load closure exceeds its gzip budget.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { gzipSync } from 'node:zlib';

const distDirectory = path.resolve(import.meta.dirname, '../dist');
const manifest = JSON.parse(readFileSync(path.join(distDirectory, '.vite/manifest.json'), 'utf8'));

const KIB = 1024;
const STARTUP_ENTRY = 'index.html';
// All application code except the bench ships at start-up; Replay is disabled (§5.10).
const HOME_ENTRIES = [STARTUP_ENTRY, 'src/boot/bootSplash.ts'];
/** Modules that must stay out of the home closure, matched against each chunk's source-map sources. */
const HOME_FORBIDDEN_SOURCES = [
  {
    name: 'Scene benchmark',
    pattern: /\/src\/routes\/bench\/SceneBench\.tsx$/,
    fix: 'only the benchmark route wrapper belongs in the start-up entry',
  },
  {
    name: 'Sentry Replay',
    pattern: /\/src\/sentryReplay\.ts$|\/node_modules\/@sentry\/replay[^/]*\//,
    fix: 'Replay is disabled and must not be reintroduced into start-up',
  },
];

/**
 * Each budget names the manifest entries a user loads for that step. A budget with
 * `beyondStartup` counts only what the step adds on top of the start-up closure.
 */
const BUDGETS = [
  {
    // Measured 2026-11-13: ~1407 KiB gzip including external word curation; approved ceiling 2000 KiB.
    name: 'home (start-up to interactive home)',
    entries: HOME_ENTRIES,
    maxGzipBytes: 2000 * KIB,
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

/** The source-map sources of each home-closure chunk, keyed by chunk file. */
function readHomeChunkSources() {
  const entryMap = path.join(distDirectory, `${manifest[STARTUP_ENTRY].file}.map`);
  if (!existsSync(entryMap)) {
    throw new Error(`Missing ${entryMap}: the home-closure checks need build.sourcemap enabled`);
  }
  const files = new Set();
  for (const entry of HOME_ENTRIES) collectLoadClosure(resolveManifestKey(entry), files);
  const sourcesByChunk = new Map();
  for (const file of files) {
    // Rolldown's injected runtime and helper chunks carry no source map.
    const mapFile = path.join(distDirectory, `${file}.map`);
    if (!file.endsWith('.js') || !existsSync(mapFile)) continue;
    sourcesByChunk.set(file, JSON.parse(readFileSync(mapFile, 'utf8')).sources);
  }
  return sourcesByChunk;
}

const startupFiles = collectLoadClosure(STARTUP_ENTRY);
const failures = [];

for (const [entry, chunk] of Object.entries(manifest)) {
  if (
    chunk.isDynamicEntry &&
    entry.startsWith('src/') &&
    entry !== 'src/routes/bench/SceneBench.tsx'
  ) {
    failures.push(`Unexpected lazy application entry: ${entry}`);
  }
}

const homeChunkSources = readHomeChunkSources();
for (const forbidden of HOME_FORBIDDEN_SOURCES) {
  const chunks = [...homeChunkSources]
    .filter(([, sources]) => sources.some((source) => forbidden.pattern.test(source)))
    .map(([file]) => file);
  if (chunks.length > 0) {
    failures.push(
      `${forbidden.name} is in the home closure (${chunks.join(', ')}); ${forbidden.fix}. ` +
        "Find the importer in the chunk's .map sources.",
    );
  }
}

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
  process.stderr.write(`Bundle check failed:\n${failures.join('\n')}\n`);
  process.exit(1);
}
