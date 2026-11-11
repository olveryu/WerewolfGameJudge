import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { expect, it } from 'vitest';

it('allows migration output larger than the default subprocess buffer', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'd1-migration-output-'));
  try {
    const scripts = path.join(root, 'scripts');
    const lib = path.join(scripts, 'lib');
    const worker = path.join(root, 'packages/api-worker');
    const bin = path.join(root, 'bin');
    const marker = path.join(root, 'applied');
    mkdirSync(lib, { recursive: true });
    mkdirSync(path.join(worker, 'migrations'), { recursive: true });
    mkdirSync(bin);
    copyFileSync(
      path.resolve('scripts/setup-d1-migrations.mjs'),
      path.join(scripts, 'setup-d1-migrations.mjs'),
    );
    copyFileSync(path.resolve('scripts/lib/devConfig.mjs'), path.join(lib, 'devConfig.mjs'));
    writeFileSync(path.join(worker, 'migrations/001.sql'), '');
    writeFileSync(
      path.join(bin, 'pnpm'),
      `#!/usr/bin/env node
const fs = require('node:fs');
if (process.argv[2] === 'run') {
  process.stdout.write('x'.repeat(1_500_000), () => fs.writeFileSync(process.env.MIGRATION_MARKER, 'done'));
} else {
  const results = fs.existsSync(process.env.MIGRATION_MARKER) ? [{ name: '001.sql' }] : [];
  process.stdout.write(JSON.stringify([{ results }]));
}
`,
      { mode: 0o755 },
    );
    const output = execFileSync(process.execPath, [path.join(scripts, 'setup-d1-migrations.mjs')], {
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${bin}${path.delimiter}${process.env.PATH ?? ''}`,
        MIGRATION_MARKER: marker,
      },
      maxBuffer: 4 * 1024 * 1024,
    });
    expect(output).toContain('D1 migrations applied');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
