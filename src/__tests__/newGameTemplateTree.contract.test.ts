/**
 * Contract test: the new-game generator keeps a single template tree,
 * and the shipped demo's capability declaration stays the demo-hybrid
 * pack row (T-4 / G-5).
 *
 * The generator used to carry one template tree per preset; T-4 merged
 * them into a single tree whose files are capability-gated, so a
 * second tree must never reappear. Demo is the shipped instance of the
 * demo-hybrid pack: its row in the capabilities contract and the
 * literal in its engine must both equal the pack row the generator
 * stamps out, or the reference game stops proving the pack.
 */

import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

const REPO_ROOT = join(__dirname, '../..');
const TEMPLATES_DIR = join(REPO_ROOT, 'scripts/lib/new-game/templates');
const GENERATE_MJS = join(REPO_ROOT, 'scripts/lib/new-game/generate.mjs');
const CAPABILITIES_CONTRACT = join(
  REPO_ROOT,
  'packages/game-engine/src/platform/engine/__tests__/capabilities.contract.test.ts',
);
const DEMO_ENGINE = join(REPO_ROOT, 'packages/game-engine/src/games/demo/engine.ts');

const CAPABILITY_KEYS = [
  'nightPhase',
  'botsAndTakeover',
  'identityViewing',
  'revealAnimation',
  'stageDeadline',
  'audioOrchestration',
  'wordLibrary',
  'gallery',
  'hostConfig',
  'botTestScaffold',
] as const;

/** Extract one `key: boolean` capability row starting at `marker`. */
function readCapabilityRow(source: string, marker: string): Record<string, boolean> {
  const start = source.indexOf(marker);
  if (start === -1) throw new Error(`capability row marker not found: ${marker}`);
  const end = source.indexOf('}', start);
  if (end === -1) throw new Error(`capability row not closed after: ${marker}`);
  const block = source.slice(start, end);
  const row: Record<string, boolean> = {};
  for (const key of CAPABILITY_KEYS) {
    const match = new RegExp(`${key}: (true|false)`).exec(block);
    if (match === null) throw new Error(`capability key ${key} missing after: ${marker}`);
    row[key] = match[1] === 'true';
  }
  return row;
}

describe('new-game generator template tree', () => {
  it('keeps exactly one game template tree next to the shared tree', () => {
    expect(readdirSync(TEMPLATES_DIR).sort()).toEqual(['game', 'shared']);
  });

  it("pins demo's declared capabilities to the demo-hybrid pack row", () => {
    const packRow = readCapabilityRow(readFileSync(GENERATE_MJS, 'utf8'), "'demo-hybrid': {");
    const contractSource = readFileSync(CAPABILITIES_CONTRACT, 'utf8');
    const expectedTable = contractSource.slice(contractSource.indexOf('EXPECTED_CAPABILITIES'));
    const contractRow = readCapabilityRow(expectedTable, '  demo: {');
    const engineRow = readCapabilityRow(readFileSync(DEMO_ENGINE, 'utf8'), 'capabilities: {');
    expect(contractRow).toEqual(packRow);
    expect(engineRow).toEqual(packRow);
  });
});
