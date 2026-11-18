/** New-game generator contract: the node:test suite for scripts/new-game.mjs must pass. */

import { execFileSync } from 'node:child_process';
import path from 'node:path';

const ROOT_DIR = path.resolve(import.meta.dirname, '..');

describe('new-game generator', () => {
  // The wrapped suite includes real-tooling cases that copy the repo
  // and run prettier/eslint for real, so
  // it needs far more than the default 10s test timeout.
  it('generates independently selected capabilities against a fixture repository', () => {
    execFileSync(process.execPath, ['--test', 'scripts/new-game.test.mjs'], {
      cwd: ROOT_DIR,
      stdio: 'inherit',
    });
  }, 900_000);
});
