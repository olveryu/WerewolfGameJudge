/**
 * Anti-reflow contract for the night-step shape (state-model plan §6.1):
 * the flat step window (currentStepIndex / currentStepId / stepDeadline as
 * GameState fields) must never come back.
 */
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

const WEREWOLF_SRC = join(__dirname, '..');

function listProductionSources(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__') continue;
      files.push(...listProductionSources(fullPath));
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
      files.push(fullPath);
    }
  }
  return files;
}

describe('night step shape anti-reflow contract', () => {
  const sources = listProductionSources(WEREWOLF_SRC).filter(
    (file) => !file.endsWith(join('state', 'parseState.ts')),
  );

  it('no production source mentions the stored step index', () => {
    const offenders = sources.filter((file) =>
      readFileSync(file, 'utf8').includes('currentStepIndex'),
    );
    expect(offenders).toEqual([]);
  });

  it('GameState declares none of the legacy flat step fields', () => {
    const types = readFileSync(join(WEREWOLF_SRC, 'domain', 'protocol', 'types.ts'), 'utf8');
    expect(types).not.toMatch(/^\s+currentStepIndex:/m);
    expect(types).not.toMatch(/^\s+currentStepId\??:/m);
    expect(types).not.toMatch(/^\s+stepDeadline\??:/m);
  });
});
