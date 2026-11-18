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
const { REPORT_STEP_COUNT, buildIntegrationReport } = await load('scripts/lib/new-game/report.mjs');
const { findLatestRegistrationMigration, nextMigrationName } = await load('scripts/lib/new-game/migration.mjs');
const facts = generatorFacts();
assert.equal(new Set(facts.sharedFiles).size, facts.sharedFiles.length);
for (const file of facts.sharedFiles) assert.ok(fs.existsSync(path.join(root, file)), file);
const reportInput = {
  gameId: 'newgame',
  names: { pascal: 'Newgame', camel: 'newgame', upper: 'NEWGAME' },
  home: { displayName: '新游戏', subtitle: '玩法', iconName: 'game-controller-outline', tier: 'mini' },
  rewards: { xpEarned: 5, normalDrawsEarned: 1, dailyCompletionTarget: 5 },
  capabilities: {
    identityViewing: false,
    botBulkViewing: false,
    audioOrchestration: false,
  },
  selectedCapabilities: [],
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
console.log(`capability keys: ${facts.capabilityKeys.join(', ')}`);
console.log(`report steps: ${steps.join(', ')}`);
console.log(`migration files: ${migrations.length}; registration source: ${findLatestRegistrationMigration(migrations).name}; next: ${nextMigrationName(migrations.map(({ name }) => name), 'newgame')}`);
JS
