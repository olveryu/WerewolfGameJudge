import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { CATALOGUES } from './registry.mjs';

export const REPOSITORY_DIRECTORY = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../..',
);

/** Resolve explicit ids in order; no ids selects all registered catalogues. */
export function selectCatalogues(ids) {
  const selected =
    ids.length === 0
      ? CATALOGUES
      : ids.map((id) => {
          const entry = CATALOGUES.find((catalogue) => catalogue.id === id);
          if (entry === undefined) throw new Error(`Unknown catalogue "${id}".`);
          return entry;
        });
  if (new Set(selected.map(({ id }) => id)).size !== selected.length) {
    throw new Error('Catalogue selection contains duplicate ids.');
  }
  return selected;
}

/** Persist the full candidate and line diff, without changing the baseline unless explicitly reviewed. */
export function compareCatalogue(
  entry,
  actual,
  {
    rootDirectory = REPOSITORY_DIRECTORY,
    reportDirectory = path.join(rootDirectory, '.catalogue-reports'),
    reviewedUpdate = false,
  } = {},
) {
  if (typeof actual !== 'string' || actual.trim().length === 0) {
    throw new Error(`Catalogue "${entry.id}" generated no content.`);
  }
  const baselinePath = path.join(rootDirectory, entry.baseline);
  const directory = path.join(reportDirectory, entry.id);
  fs.mkdirSync(directory, { recursive: true });
  const exists = fs.existsSync(baselinePath);
  const expected = exists ? fs.readFileSync(baselinePath, 'utf8') : null;
  const matches = expected === actual;
  const candidatePath = path.join(directory, 'candidate.txt');
  fs.writeFileSync(candidatePath, actual);
  fs.writeFileSync(path.join(directory, 'baseline.txt'), expected ?? '');
  const diff = spawnSync(
    'git',
    [
      'diff',
      '--no-index',
      '--no-color',
      '--no-ext-diff',
      '--',
      path.join(directory, 'baseline.txt'),
      candidatePath,
    ],
    { encoding: 'utf8' },
  );
  if (diff.error !== undefined) throw diff.error;
  if (diff.status !== 0 && diff.status !== 1) {
    throw new Error(
      `Catalogue diff failed for ${entry.id}: ${diff.stderr || `exit ${diff.status}`}`,
    );
  }
  const difference = exists
    ? diff.stdout
    : `Baseline is missing: ${entry.baseline}\n${diff.stdout}`;
  fs.writeFileSync(path.join(directory, 'difference.diff'), difference);
  if (reviewedUpdate) {
    fs.mkdirSync(path.dirname(baselinePath), { recursive: true });
    fs.writeFileSync(baselinePath, actual);
  }
  const result = {
    id: entry.id,
    title: entry.title,
    baseline: entry.baseline,
    status: reviewedUpdate && !matches ? 'updated' : matches ? 'unchanged' : 'changed',
    baselineExisted: exists,
    reportDirectory: directory,
  };
  fs.writeFileSync(path.join(directory, 'result.json'), `${JSON.stringify(result, null, 2)}\n`);
  return result;
}

/** Test entrypoint: ordinary tests, including Vitest -u, cannot approve or create a baseline. */
export function verifyCatalogue(id, actual) {
  const [entry] = selectCatalogues([id]);
  const updateIds = (process.env.CATALOGUE_REVIEWED_UPDATE ?? '').split(',').filter(Boolean);
  selectCatalogues(updateIds);
  if (process.env.CI && updateIds.length > 0) {
    throw new Error('Catalogue baselines must not be updated in CI.');
  }
  const result = compareCatalogue(entry, actual, {
    reviewedUpdate: updateIds.includes(id),
    reportDirectory: process.env.CATALOGUE_REPORT_DIRECTORY,
  });
  if (result.status === 'changed') {
    throw new Error(
      `Catalogue "${id}" differs from its reviewed baseline. Full candidate and line diff: ${result.reportDirectory}. Confirm the changes before running catalogue:update; do not edit the generated file.`,
    );
  }
}
