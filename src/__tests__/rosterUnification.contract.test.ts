/**
 * Roster unification — client contract.
 *
 * The retired implicit-bot derivation (ImplicitBotSeat) must not come back
 * anywhere in client production code; bot identity is derived once from the
 * server roster. The takeover gesture / guard composition is locked by
 * src/games/__tests__/gameClientShape.contract.test.ts.
 */

import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

const SRC_ROOT = join(__dirname, '..');

function productionSources(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
      files.push(...productionSources(full));
    } else if (
      (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) &&
      !entry.name.endsWith('.test.ts') &&
      !entry.name.endsWith('.test.tsx')
    ) {
      files.push(full);
    }
  }
  return files;
}

describe('roster unification client contract', () => {
  it('no client production source references the retired implicit-bot derivation', () => {
    for (const file of productionSources(SRC_ROOT)) {
      expect(readFileSync(file, 'utf8')).not.toContain('ImplicitBotSeat');
    }
  });
});
