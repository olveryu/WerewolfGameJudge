import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { REPOSITORY_DIRECTORY, selectCatalogues } from './lib/catalogues/verify.mjs';

const [mode, ...argumentsList] = process.argv.slice(2);
if (mode !== 'check' && mode !== 'update') {
  throw new Error('Usage: catalogues.mjs check [ids...] | update --reviewed <ids...>');
}
const reviewed = argumentsList.includes('--reviewed');
const ids = argumentsList.filter((argument) => argument !== '--reviewed');
if (mode === 'update' && (!reviewed || ids.length === 0 || process.env.CI)) {
  throw new Error('Updating requires explicit catalogue ids and --reviewed, outside CI.');
}
if (mode === 'check' && reviewed) throw new Error('--reviewed is valid only for update.');
const catalogues = selectCatalogues(ids);
const reportDirectory = path.join(REPOSITORY_DIRECTORY, '.catalogue-reports');
fs.mkdirSync(reportDirectory, { recursive: true });
for (const { id } of catalogues) {
  for (const file of ['result.json', 'candidate.txt', 'baseline.txt', 'difference.diff']) {
    fs.rmSync(path.join(reportDirectory, id, file), { force: true });
  }
}
const packages = [...new Set(catalogues.map(({ packageName }) => packageName))];
const failures = [];
for (const packageName of packages) {
  const selected = catalogues.filter((entry) => entry.packageName === packageName);
  const command = spawnSync(
    'corepack',
    ['pnpm', '--filter', packageName, 'run', 'test', ...selected.map(({ test }) => test)],
    {
      cwd: REPOSITORY_DIRECTORY,
      stdio: 'inherit',
      env: {
        ...process.env,
        CATALOGUE_REPORT_DIRECTORY: reportDirectory,
        CATALOGUE_REVIEWED_UPDATE: mode === 'update' ? ids.join(',') : '',
      },
    },
  );
  if (command.error !== undefined) throw command.error;
  if (command.status !== 0)
    failures.push(`${packageName}: exit ${command.status}, signal ${command.signal ?? 'none'}`);
}
const summary = [
  '# Catalogue verification',
  '',
  'Baselines are changed only by an explicitly reviewed local update.',
  '',
];
for (const { id, title, baseline } of catalogues) {
  const resultPath = path.join(reportDirectory, id, 'result.json');
  if (!fs.existsSync(resultPath)) {
    failures.push(`${id}: test did not produce a catalogue; inspect the test failure above`);
    summary.push(`- **${title}**: not generated; verification failed.`);
    continue;
  }
  const result = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
  if (result.status === 'changed')
    failures.push(`${id}: candidate differs from the reviewed baseline`);
  summary.push(
    `- **${title}**: ${result.status}; baseline: \`${baseline}\`; full diff: \`${id}/difference.diff\`.`,
  );
}
if (failures.length > 0)
  summary.push('', '## Failures', ...failures.map((failure) => `- ${failure}`));
const text = `${summary.join('\n')}\n`;
fs.writeFileSync(path.join(reportDirectory, 'README.md'), text);
process.stdout.write(`${text}\nFull reports: ${reportDirectory}\n`);
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, text);
process.exitCode = failures.length > 0 ? 1 : 0;
