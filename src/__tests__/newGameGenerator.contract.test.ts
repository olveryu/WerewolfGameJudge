/** New-game generator contract: the node:test suite for scripts/new-game.mjs must pass. */

import { execFileSync } from 'node:child_process';
import path from 'node:path';

const ROOT_DIR = path.resolve(__dirname, '../..');

describe('new-game generator', () => {
  // The wrapped suite includes a real-tooling case that copies the
  // repo and runs prettier/eslint for real, so it needs far more than
  // the default 10s test timeout.
  it('generates both presets completely against a fixture repository', () => {
    execFileSync(process.execPath, ['--test', 'scripts/new-game.test.mjs'], {
      cwd: ROOT_DIR,
      stdio: 'pipe',
    });
  }, 300_000);
});
