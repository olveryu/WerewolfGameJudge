/**
 * Roster unification + takeover long-press — client contract.
 *
 * Two client-side locks from the roster unification:
 * - The retired implicit-bot derivation (ImplicitBotSeat) must not come
 *   back anywhere in client production code; bot identity is derived once
 *   from the server roster (e.g. werewolf's toWerewolfLocalState).
 * - Bot takeover starts from exactly one shared gesture implementation:
 *   every game's room hook routes its takeover entry through
 *   useBotTakeoverLongPress. Re-implementing a per-game long-press
 *   takeover (toggle logic, capability checks) is drift. Release is
 *   locked separately by botTakeoverGuard.contract.test.ts.
 */

import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';

const SRC_ROOT = join(__dirname, '..');

function readSource(relativePath: string): string {
  const fullPath = join(SRC_ROOT, relativePath);
  if (!existsSync(fullPath)) throw new Error(`Expected source file to exist: ${relativePath}`);
  return readFileSync(fullPath, 'utf8');
}

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

const LONG_PRESS_CONSUMERS = [
  'games/werewolf/room/hooks/useWerewolfRoomScreenState.ts',
  'games/avalon/room/hooks/useAvalonRoomState.ts',
  'games/fibking/room/hooks/useFibRoomScreenState.ts',
  'games/undercover/room/hooks/useUndercoverRoster.ts',
  'games/pictionary/room/hooks/usePictionaryRoomScreenState.ts',
  'games/storyrelay/room/hooks/useStoryRelayRoomState.ts',
  'games/drawguess/room/hooks/useDrawGuessRoomState.ts',
] as const;

describe('roster unification client contract', () => {
  it('no client production source references the retired implicit-bot derivation', () => {
    for (const file of productionSources(SRC_ROOT)) {
      expect(readFileSync(file, 'utf8')).not.toContain('ImplicitBotSeat');
    }
  });

  it('every game routes bot takeover through the shared long-press hook', () => {
    for (const consumer of LONG_PRESS_CONSUMERS) {
      expect(readSource(consumer)).toMatch(/useBotTakeoverLongPress\(/);
    }
  });
});
