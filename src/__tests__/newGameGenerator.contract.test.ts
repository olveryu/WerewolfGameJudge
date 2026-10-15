/** New-game generator contract: the node:test suite for scripts/new-game.mjs must pass. */

import { execFileSync } from 'node:child_process';
import path from 'node:path';

const ROOT_DIR = path.resolve(__dirname, '../..');

describe('new-game generator', () => {
  // The suite includes a full-source fixture that runs the real
  // type-aware eslint over generated output; that takes well over
  // the default 10s test timeout.
  it('generates both presets completely against a fixture repository', () => {
    execFileSync(process.execPath, ['--test', 'scripts/new-game.test.mjs'], {
      cwd: ROOT_DIR,
      stdio: 'pipe',
    });
  }, 300_000);
});
