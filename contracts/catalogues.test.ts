import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  compareCatalogue,
  selectCatalogues,
  verifyCatalogue,
} from '../scripts/lib/catalogues/verify.mjs';

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0)) fs.rmSync(directory, { recursive: true });
});

function fixture() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'catalogue-verification-'));
  directories.push(directory);
  const entry = {
    id: 'example',
    title: 'Example',
    packageName: 'example',
    test: 'example.test.ts',
    baseline: 'snapshots/example.txt',
  };
  fs.mkdirSync(path.join(directory, 'snapshots'));
  return { directory, entry, baseline: path.join(directory, entry.baseline) };
}

describe('catalogue baseline approval', () => {
  it('rejects an empty generated catalogue and CI approval attempts', () => {
    const { directory, entry } = fixture();
    expect(() => compareCatalogue(entry, '', { rootDirectory: directory })).toThrow(
      'generated no content',
    );
    const ci = process.env.CI;
    const reviewed = process.env.CATALOGUE_REVIEWED_UPDATE;
    try {
      process.env.CI = 'true';
      process.env.CATALOGUE_REVIEWED_UPDATE = 'werewolf-night';
      expect(() => verifyCatalogue('werewolf-night', 'candidate')).toThrow(
        'must not be updated in CI',
      );
    } finally {
      if (ci === undefined) delete process.env.CI;
      else process.env.CI = ci;
      if (reviewed === undefined) delete process.env.CATALOGUE_REVIEWED_UPDATE;
      else process.env.CATALOGUE_REVIEWED_UPDATE = reviewed;
    }
  });
  it('records the full changed candidate and line diff without modifying the baseline', () => {
    const { directory, entry, baseline } = fixture();
    fs.writeFileSync(baseline, 'keep\nold sentence\n');
    const result = compareCatalogue(entry, 'keep\nnew sentence\n', { rootDirectory: directory });
    expect(result.status).toBe('changed');
    expect(fs.readFileSync(baseline, 'utf8')).toBe('keep\nold sentence\n');
    expect(fs.readFileSync(path.join(result.reportDirectory, 'candidate.txt'), 'utf8')).toBe(
      'keep\nnew sentence\n',
    );
    const difference = fs.readFileSync(
      path.join(result.reportDirectory, 'difference.diff'),
      'utf8',
    );
    expect(difference).toContain('-old sentence');
    expect(difference).toContain('+new sentence');
  });

  describe('catalogue reporting command', () => {
    it('rejects an implicit update before invoking any package tests', () => {
      const script = path.resolve(import.meta.dirname, '../scripts/catalogues.mjs');
      for (const args of [
        ['update'],
        ['update', 'werewolf-night'],
        ['check', '--reviewed', 'werewolf-night'],
      ]) {
        const result = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });
        expect(result.status).toBe(1);
        expect(result.stderr).toMatch(/Updating requires|valid only for update/);
      }
    });

    it('reports missing generation, discards stale reports and still tries the other package', () => {
      const { directory } = fixture();
      const root = path.resolve(import.meta.dirname, '..');
      for (const file of [
        'scripts/catalogues.mjs',
        'scripts/lib/catalogues/verify.mjs',
        'scripts/lib/catalogues/registry.mjs',
      ]) {
        const target = path.join(directory, file);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.copyFileSync(path.join(root, file), target);
      }
      const bin = path.join(directory, 'bin');
      fs.mkdirSync(bin);
      fs.writeFileSync(
        path.join(bin, 'corepack'),
        `#!${process.execPath}
  import fs from 'node:fs';
  const packageName = process.argv[4];
  fs.appendFileSync(process.env.EXECUTIONS_FILE, packageName + '\\n');
  if (packageName === '@game-judge/game-engine') process.exit(1);
  const directory = process.env.CATALOGUE_REPORT_DIRECTORY + '/werewolf-sheriff';
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(directory + '/result.json', JSON.stringify({ status: 'unchanged' }));
  `,
        { mode: 0o755 },
      );
      const stale = path.join(directory, '.catalogue-reports/werewolf-night');
      fs.mkdirSync(stale, { recursive: true });
      fs.writeFileSync(path.join(stale, 'result.json'), '{"status":"unchanged"}');
      fs.writeFileSync(path.join(stale, 'candidate.txt'), 'old candidate');
      const result = spawnSync(
        process.execPath,
        [
          path.join(directory, 'scripts/catalogues.mjs'),
          'check',
          'werewolf-night',
          'werewolf-sheriff',
        ],
        {
          encoding: 'utf8',
          env: {
            ...process.env,
            PATH: `${bin}:${process.env.PATH}`,
            EXECUTIONS_FILE: path.join(directory, 'executions.txt'),
          },
        },
      );
      expect(result.status).toBe(1);
      expect(
        fs.readFileSync(path.join(directory, 'executions.txt'), 'utf8').trim().split('\n'),
      ).toEqual(['@game-judge/game-engine', '@game-judge/web']);
      expect(result.stdout).toContain('not generated');
      expect(result.stdout).toContain('unchanged');
      expect(fs.existsSync(path.join(stale, 'candidate.txt'))).toBe(false);
    });
  });

  it('fails a missing baseline instead of accepting the first generated result', () => {
    const { directory, entry, baseline } = fixture();
    const result = compareCatalogue(entry, 'new\n', { rootDirectory: directory });
    expect(result.status).toBe('changed');
    expect(result.baselineExisted).toBe(false);
    expect(fs.existsSync(baseline)).toBe(false);
  });

  it('updates only when explicitly reviewed and compares subsequent runs to that baseline', () => {
    const { directory, entry, baseline } = fixture();
    const result = compareCatalogue(entry, 'approved\n', {
      rootDirectory: directory,
      reviewedUpdate: true,
    });
    expect(result.status).toBe('updated');
    expect(fs.readFileSync(baseline, 'utf8')).toBe('approved\n');
    expect(compareCatalogue(entry, 'approved\n', { rootDirectory: directory }).status).toBe(
      'unchanged',
    );
  });

  it('rejects unknown or duplicate selections before running tests', () => {
    expect(() => selectCatalogues(['not-registered'])).toThrow('Unknown catalogue');
    expect(() => selectCatalogues(['werewolf-night', 'werewolf-night'])).toThrow('duplicate');
  });
});
