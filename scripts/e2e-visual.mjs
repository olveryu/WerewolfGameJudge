#!/usr/bin/env node
/**
 * Visual gate runner (UI drift lock P2): the one way to run `e2e/visual`.
 *
 * Screenshot baselines are only comparable from one rendering environment, so
 * the suite always runs inside the official Playwright image whose tag is the
 * installed `@playwright/test` version (fonts, Chromium build and rasterizer
 * are then identical on every machine). CI calls this script too
 * (`.github/workflows/e2e-run.yml`, suite `visual`).
 *
 * The repository (with its installed node_modules and, on CI, the prebuilt
 * `packages/web/dist`) is mounted at its own path; the container shares the
 * host network so the API (:8787) and web (:8081) servers that the Playwright
 * config starts are reachable as on the host.
 *
 * Usage:
 *   node scripts/e2e-visual.mjs            compare with the committed baselines
 *   node scripts/e2e-visual.mjs --update   rewrite the baselines
 * Any further arguments are passed to `playwright test`.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const require = createRequire(import.meta.url);
const { version } = require('@playwright/test/package.json');
const { packageManager } = require('../package.json');
if (!/^pnpm@\d+\.\d+\.\d+$/.test(packageManager)) {
  throw new Error(`[e2e-visual] packageManager must pin pnpm@x.y.z, got ${packageManager}`);
}
const IMAGE = `mcr.microsoft.com/playwright:v${version}-noble`;

/** Writable home inside the container (the image's home belongs to its own user). */
const HOME = '/tmp/e2e-visual-home';
const BIN = `${HOME}/bin`;

const args = process.argv.slice(2);
const update = args.includes('--update');
const passThrough = args.filter((arg) => arg !== '--update');

try {
  execFileSync('docker', ['version', '--format', '{{.Server.Version}}'], { stdio: 'ignore' });
} catch (cause) {
  console.error(
    `[e2e-visual] Docker is required: the visual baselines exist only for ${IMAGE}.`,
    cause instanceof Error ? cause.message : cause,
  );
  process.exit(1);
}

const playwrightArgs = [
  'exec',
  'playwright',
  'test',
  '--config',
  'playwright.visual.config.ts',
  ...(update ? ['--update-snapshots=all'] : []),
  ...passThrough,
];
const env = ['CI', 'GITHUB_ACTIONS'].flatMap((name) =>
  process.env[name] === undefined ? [] : ['-e', `${name}=${process.env[name]}`],
);

console.log(`[e2e-visual] ${IMAGE} · ${update ? 'update baselines' : 'compare'}`);
const run = spawnSync(
  'docker',
  [
    'run',
    '--rm',
    '--network=host',
    '--ipc=host',
    '--init',
    // Files written into the mounted repository keep the caller's ownership.
    '--user',
    `${process.getuid()}:${process.getgid()}`,
    '-e',
    `HOME=${HOME}`,
    ...env,
    '-v',
    `${ROOT}:${ROOT}`,
    '-w',
    ROOT,
    IMAGE,
    'bash',
    '-c',
    // The image has no corepack (CI run 46059503167: `corepack: command not found`), so
    // npm installs the pnpm pinned by `packageManager` into the container's home and puts
    // it on PATH: the Playwright config's servers call `pnpm` themselves.
    `npm install --global --silent --prefix ${HOME} ${packageManager} && PATH=${BIN}:$PATH pnpm "$@"`,
    'e2e-visual',
    ...playwrightArgs,
  ],
  { stdio: 'inherit' },
);
if (run.error) {
  console.error('[e2e-visual] docker run failed to start:', run.error.message);
  process.exit(1);
}
process.exit(run.status ?? 1);
