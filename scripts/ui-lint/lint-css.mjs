#!/usr/bin/env node
/**
 * `pnpm run lint:css`: the web client's stylesheets carry no violation beyond the recorded
 * baseline (`ui-style-baseline.json`), with the scope and configuration checks of
 * `styleGate.mjs`. With file arguments (lint-staged), only those files are linted; the
 * configuration check still covers the repository.
 *
 * The baseline being exact and shrink-only is the ratchet's job (`pnpm run lint:ui-baseline`).
 */
import path from 'node:path';

import {
  checkAllStyles,
  configProblems,
  lintStyles,
  readBaseline,
  STYLE_BASELINE,
  styleScope,
  uncovered,
} from './styleGate.mjs';

const cwd = process.cwd();
const args = process.argv.slice(2);

let problems;
let found;
let warnings;
if (args.length === 0) {
  ({ problems, found, warnings } = await checkAllStyles(cwd));
} else {
  const files = args.map((file) => path.relative(cwd, path.resolve(cwd, file)));
  const scope = styleScope(cwd, files);
  const lint = await lintStyles(cwd, scope.stylesheets);
  ({ found, warnings } = lint);
  problems = [...configProblems(cwd), ...scope.problems, ...lint.skipped];
}

// Uncovered fingerprints, as a multiset: which of several identical warnings is the new one is
// unknowable, so each extra one is reported once at the first matching location.
const fresh = new Map();
for (const key of uncovered(readBaseline(cwd), found)) fresh.set(key, (fresh.get(key) ?? 0) + 1);
const report = [...problems];
for (const { file, rule, print, warning } of warnings) {
  const key = `${file} → ${rule}: ${print}`;
  const left = fresh.get(key) ?? 0;
  if (left === 0) continue;
  fresh.set(key, left - 1);
  report.push(`${file}:${warning.line}:${warning.column} ${warning.text}`);
}

if (report.length > 0) {
  console.error(
    [
      `UI gate (CSS): ${report.length} problem(s) not covered by ${STYLE_BASELINE}:`,
      ...report,
    ].join('\n'),
  );
  process.exitCode = 1;
}
