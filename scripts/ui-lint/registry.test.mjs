/**
 * Every allow list of the registry is pinned exactly by snapshot (plan v3 §3): widening one shows
 * up as a change to `__snapshots__/registry.test.mjs.snap`, not only as a registry line. The
 * build facts the bundle graph relies on are checked against their sources.
 */
import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { REPO_ROOT } from './bundle.mjs';
import * as registry from './registry.mjs';
import { BUILD_ENTRIES, ELEMENTS, PACKAGES, WEB_ROOT } from './registry.mjs';

/** Sets and maps as sorted plain data, so the snapshot shows every entry. */
const plain = (value) => {
  if (value instanceof Set) return [...value].map(plain).sort();
  if (value instanceof Map)
    return Object.fromEntries([...value].sort().map(([k, v]) => [k, plain(v)]));
  if (Array.isArray(value)) return value.map(plain);
  if (value && typeof value === 'object')
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, plain(v)]));
  return value;
};

const read = (file) => fs.readFileSync(path.join(REPO_ROOT, file), 'utf8');

describe('UI gate registry', () => {
  // Every allow list is pinned entry by entry: widening one (a property moved to `free`, a
  // keyword, a function, an element, a DOM member, a package) changes this snapshot, which the
  // reviewer sees and CI does not rewrite (P1 QA5 K9).
  it.each(Object.keys(registry).sort())('pins %s exactly', (name) => {
    expect(plain(registry[name])).toMatchSnapshot();
  });

  it('registers exactly the web manifest dependencies', () => {
    const manifest = JSON.parse(read(`${WEB_ROOT}/package.json`));
    expect(
      Object.keys(PACKAGES)
        .filter((name) => PACKAGES[name].field === 'dependencies')
        .sort(),
    ).toEqual(Object.keys(manifest.dependencies).sort());
  });

  it('never registers an element that loads or holds a stylesheet or script (E11)', () => {
    for (const tag of ['style', 'link', 'script', 'base', 'object', 'embed', 'template'])
      expect(ELEMENTS.has(tag), tag).toBe(false);
  });

  it('lists the entries the boot splash plugin adds', () => {
    const source = read('packages/web/build-plugins/bootSplash.ts').match(
      /const BOOT_SPLASH_SOURCE = '([^']+)'/,
    )[1];
    expect(BUILD_ENTRIES).toEqual([`${WEB_ROOT}/${source}`]);
  });

  it('resolves the same aliases as Vite', () => {
    const vite = read('packages/web/vite.config.ts');
    const tsconfig = read('packages/web/tsconfig.json');
    expect(vite).toContain('{ find: /^@\\//, replacement: `${sourceDirectory}/` }');
    expect(vite).toContain(
      '{ find: /^@game-judge\\/game-engine\\//, replacement: `${engineSourceDirectory}/` }',
    );
    expect(vite.match(/\{ find: /g)).toHaveLength(2);
    expect(tsconfig).toContain('"@/*": ["./src/*"]');
    expect(tsconfig).toContain('"@game-judge/game-engine/*": ["../game-engine/src/*"]');
  });
});
