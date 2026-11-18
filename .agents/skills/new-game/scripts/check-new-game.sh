#!/bin/sh
# Read-only generator-count checks. Run from the repo root:
#   sh .agents/skills/new-game/scripts/check-new-game.sh [repo-root]
# Counts and gates come from the generator itself, not documentation literals.
set -eu
ROOT="${1:-$(cd "$(dirname "$0")/../../../.." && pwd)}"
node --input-type=module - "$ROOT" <<'JS'
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2]);
const load = (file) => import(pathToFileURL(path.join(root, file)).href);
const { generatorFacts } = await load('scripts/lib/new-game/generate.mjs');
const { deriveCapabilities, FEATURE_KEYS, FEATURE_VALUES } = await load('scripts/lib/new-game/features.mjs');
const { REPORT_STEP_COUNT, buildIntegrationReport } = await load('scripts/lib/new-game/report.mjs');
const { findLatestRegistrationMigration, nextMigrationName } = await load('scripts/lib/new-game/migration.mjs');
const facts = generatorFacts();
const baseTestCaseCount = facts.baseTestRequirements.reduce(
  (count, item) => count + item.testCases.length,
  0,
);
const featureTestCaseCount = Object.values(facts.featureTestRequirements).reduce(
  (count, items) =>
    count + items.reduce((total, item) => total + item.testCases.length, 0),
  0,
);
assert.equal(new Set(facts.sharedFiles).size, facts.sharedFiles.length);
for (const file of facts.sharedFiles) assert.ok(fs.existsSync(path.join(root, file)), file);
assert.ok(facts.baseTestRequirements.length > 0);
for (const requirement of facts.baseTestRequirements) {
  assert.ok(requirement.template);
  assert.ok(requirement.testCases.length > 0);
}
for (const [feature, requirements] of Object.entries(facts.featureTestRequirements)) {
  assert.ok(facts.featureKeys.includes(feature), feature);
  assert.ok(requirements.length > 0);
  for (const requirement of requirements) {
    assert.ok(requirement.template);
    assert.ok(requirement.testCases.length > 0);
  }
}
const features = Object.fromEntries(FEATURE_KEYS.map((key) => [key, FEATURE_VALUES[key][0]]));
const reportInput = {
  gameId: 'newgame',
  names: { pascal: 'Newgame', camel: 'newgame', upper: 'NEWGAME' },
  home: { displayName: '新游戏', subtitle: '玩法', iconName: 'game-controller-outline', tier: 'mini' },
  rewards: { xpEarned: 5, normalDrawsEarned: 1, dailyCompletionTarget: 5 },
  capabilities: deriveCapabilities(features),
  features,
  createdFiles: [],
  editedFiles: [],
  migrationName: '0000_newgame.sql',
};
const steps = [];
for (const production of [false, true]) {
  const report = buildIntegrationReport({ ...reportInput, production });
  const reportSteps = [...report.matchAll(/^(\d+)\.\s+\*\*/gm)].map((match) => Number(match[1]));
  assert.deepEqual(reportSteps, Array.from({ length: REPORT_STEP_COUNT }, (_, index) => index + 1));
  if (steps.length === 0) steps.push(...reportSteps);
}
const dir = path.join(root, 'packages/api-worker/migrations');
const migrations = fs.readdirSync(dir).filter((name) => name.endsWith('.sql')).map((name) => ({
  name, content: fs.readFileSync(path.join(dir, name), 'utf8'),
}));
console.log(`SHARED_EDITS entries: ${facts.sharedFiles.length}`);
console.log(`template files: ${facts.templateCount}`);
console.log(`feature keys: ${facts.featureKeys.join(', ')}`);
console.log(`behavior test cases: ${baseTestCaseCount} base; ${featureTestCaseCount} conditional`);
console.log(`report steps: ${steps.join(', ')}`);
console.log(`migration files: ${migrations.length}; registration source: ${findLatestRegistrationMigration(migrations).name}; next: ${nextMigrationName(migrations.map(({ name }) => name), 'newgame')}`);
JS
