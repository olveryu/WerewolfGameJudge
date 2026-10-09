/**
 * BoardInfo role preview — client contract.
 *
 * The shared BoardInfoCard renders role rows for four games. The press
 * callback used to be optional, and two games (fibking, undercover)
 * silently shipped dead rows. onRolePress is now a required prop —
 * tsc enforces it — and these assertions pin the contract and every
 * consumer's wiring so the drift cannot return unnoticed.
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const SRC_ROOT = join(__dirname, '..');

function readSource(relativePath: string): string {
  const fullPath = join(SRC_ROOT, relativePath);
  if (!existsSync(fullPath)) throw new Error(`Expected source file to exist: ${relativePath}`);
  return readFileSync(fullPath, 'utf8');
}

describe('board info role preview contract', () => {
  it('BoardInfoCard requires onRolePress', () => {
    const card = readSource('features/room/components/BoardInfoCard.tsx');
    expect(card).toMatch(/onRolePress: \(roleId: string\) => void;/);
    expect(card).not.toMatch(/onRolePress\?:/);
  });

  it('every BoardInfoCard consumer wires onRolePress', () => {
    const consumers = [
      'games/werewolf/room/WerewolfRoomScreen.tsx',
      'games/avalon/room/components/AvalonBoardInfoCard.tsx',
      'games/fibking/room/FibRoomScreen.tsx',
      'games/undercover/room/UndercoverRoomScreen.tsx',
    ];
    for (const consumer of consumers) {
      expect(readSource(consumer)).toMatch(/onRolePress/);
    }
  });

  it('fibking and undercover previews render the shared static card without the reveal gate', () => {
    const fibScreen = readSource('games/fibking/room/FibRoomScreen.tsx');
    expect(fibScreen).toMatch(/toFibRolePreviewData\(previewRole\)/);
    const undercoverScreen = readSource('games/undercover/room/UndercoverRoomScreen.tsx');
    expect(undercoverScreen).toMatch(/toUndercoverRolePreviewData\(previewRole\)/);
    // Preview builders carry kind-level public info only: no round view input.
    const fibAdapter = readSource('games/fibking/room/components/FibRoleCardAdapter.ts');
    expect(fibAdapter).toMatch(/export function toFibRolePreviewData\(role: FibRole\)/);
    const undercoverAdapter = readSource(
      'games/undercover/room/components/UndercoverRoleCardAdapter.ts',
    );
    expect(undercoverAdapter).toMatch(
      /export function toUndercoverRolePreviewData\(role: UndercoverRole\)/,
    );
  });
});
