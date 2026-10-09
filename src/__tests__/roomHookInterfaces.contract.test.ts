/**
 * Room hook explicit interfaces — client contract (P-2b).
 *
 * Following the Werewolf P2-1 end state, every game's room hook
 * assembles all domain derivation in the hook and pins the result with
 * one named exported interface (paradigm: FibRoomScreenState). These
 * assertions stop the contract from silently degrading back to an
 * inferred flat bag or Screen-side derivation. One describe per batch.
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const SRC_ROOT = join(__dirname, '..');

function readSource(relativePath: string): string {
  const fullPath = join(SRC_ROOT, relativePath);
  if (!existsSync(fullPath)) throw new Error(`Expected source file to exist: ${relativePath}`);
  return readFileSync(fullPath, 'utf8');
}

/** The hook's final top-level return block must not spread sub-objects. */
function expectNoReturnSpread(hookSource: string): void {
  const returnStart = hookSource.lastIndexOf('\n  return {');
  if (returnStart < 0) throw new Error('Expected a top-level return block in the hook');
  const returnBlock = hookSource.slice(returnStart);
  expect(returnBlock).not.toMatch(/\.\.\.[a-zA-Z_[(]/);
}

describe('room hook interfaces — avalon (P-2b batch 1)', () => {
  it('the hook exports AvalonRoomScreenState and annotates its return', () => {
    const hook = readSource('games/avalon/room/hooks/useAvalonRoomState.ts');
    expect(hook).toMatch(/export interface AvalonRoomScreenState/);
    expect(hook).toMatch(/\): AvalonRoomScreenState \{/);
    expectNoReturnSpread(hook);
  });

  it('the per-viewer view model is assembled in the hook, not the Screen', () => {
    const hook = readSource('games/avalon/room/hooks/useAvalonRoomState.ts');
    expect(hook).toMatch(/getAvalonViewModel\(state, effectiveSeat\)/);
    const screen = readSource('games/avalon/room/AvalonRoomScreen.tsx');
    expect(screen).not.toMatch(/getAvalonViewModel/);
    expect(screen).toMatch(/screen\.viewModel/);
  });
});
