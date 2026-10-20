/**
 * Role Viewing Protocol — client contract (P-1).
 *
 * The presentation layer of the Identity Viewing Protocol is a single
 * shared gate: RevealAnimationGate. These assertions pin its boundary in
 * batch 0; each migration batch (werewolf A, undercover B, avalon C,
 * fibking D) adds the assertion that the game's card path renders
 * through the gate with its anchor taken from the server projection.
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const SRC_ROOT = join(__dirname, '..', '..', '..');

function readSource(relativePath: string): string {
  const fullPath = join(SRC_ROOT, relativePath);
  if (!existsSync(fullPath)) throw new Error(`Expected source file to exist: ${relativePath}`);
  return readFileSync(fullPath, 'utf8');
}

describe('role viewing protocol — shared gate boundary', () => {
  const gatePath = 'features/room/components/RevealAnimationGate.tsx';

  it('the shared gate exists and exports RevealAnimationGate', () => {
    const source = readSource(gatePath);
    expect(source).toMatch(/export const RevealAnimationGate/);
    expect(source).toMatch(/export interface RevealAnimationGateProps/);
  });

  it('the gate renders through the single shared RoleRevealAnimator', () => {
    const source = readSource(gatePath);
    expect(source).toMatch(/from '\.\/RoleRevealEffects\/RoleRevealAnimator'/);
    expect(source).toMatch(/<RoleRevealAnimator/);
  });

  it('the gate is game-agnostic (no per-game imports, no game state)', () => {
    const source = readSource(gatePath);
    expect(source).not.toMatch(/from '@\/games\//);
    expect(source).not.toMatch(/from '@game-judge\/game-engine\/games\//);
    expect(source).not.toMatch(/from '\.\.[^']*\/games\//);
  });

  it('the gate takes its anchor as data (shouldPlay) instead of reading stores itself', () => {
    const source = readSource(gatePath);
    expect(source).toMatch(/readonly shouldPlay: boolean/);
    expect(source).not.toMatch(/useRoomStore|useGameStore|zustand/);
  });
});

describe('role viewing protocol — werewolf (batch A)', () => {
  it('the werewolf role card renders through the shared gate', () => {
    const source = readSource('games/werewolf/room/components/WerewolfRoleCardModal.tsx');
    expect(source).toMatch(/<RevealAnimationGate/);
    expect(source).toMatch(/shouldPlay=\{shouldPlayAnimation\}/);
    // The hand-rolled play-once state must not come back.
    expect(source).not.toMatch(/animationDone/);
  });
});

describe('role viewing protocol — avalon (batch C)', () => {
  it('the avalon role card renders through the shared gate with the server anchor', () => {
    const modal = readSource('games/avalon/room/components/AvalonRoleCardModal.tsx');
    expect(modal).toMatch(/<RevealAnimationGate/);
    expect(modal).not.toMatch(/animationDone/);
    const hook = readSource('games/avalon/room/hooks/useAvalonRoomState.ts');
    // Opening the card records the view for the effective seat (the
    // controlled seat is passed explicitly; the submit default is null).
    expect(hook).toMatch(
      /void submit\('查看身份', \{ type: 'avalon\.role\.viewed' \}, controlledSeat\)/,
    );
    expect(hook).toMatch(/!state\.roleViewedSeats\.includes\(effectiveSeat\)/);
    const screen = readSource('games/avalon/room/AvalonRoomScreen.tsx');
    // D-1: a controlled bot's card never plays the controller's effect.
    expect(screen).toMatch(/screen\.controlledSeat !== null/);
  });
});

describe('role viewing protocol — undercover (batch B)', () => {
  it('the undercover word card renders through the shared gate with the confirmedSeats anchor', () => {
    const modal = readSource('games/undercover/room/components/UndercoverWordModal.tsx');
    expect(modal).toMatch(/<RevealAnimationGate/);
    expect(modal).not.toMatch(/animationDone/);
    const screen = readSource('games/undercover/room/UndercoverRoomScreen.tsx');
    expect(screen).toMatch(/!state\.round\.confirmedSeats\.includes\(controls\.card\.seat\)/);
    // D-1: a controlled bot's card never plays the controller's effect.
    expect(screen).toMatch(/effectType=\{isControlled \? null : equippedRevealEffect\}/);
  });
});

describe('role viewing protocol — fibking (batch D)', () => {
  it('the fibking identity card renders through the shared gate with the viewedSeats anchor', () => {
    const modal = readSource('games/fibking/room/components/FibIdentityModal.tsx');
    expect(modal).toMatch(/<RevealAnimationGate/);
    expect(modal).not.toMatch(/animationDone/);
    expect(modal).not.toMatch(/RoleRevealAnimator/);
    const hook = readSource('games/fibking/room/hooks/useFibRoomScreenState.ts');
    // The anchor is the server-side per-round viewed record.
    expect(hook).toMatch(/state\.round\.viewedSeats\.includes\(effectiveSeat\)/);
    // The modal confirm submits the viewing record while in the viewing phase.
    expect(hook).toMatch(/\{ type: 'fibking\.role\.viewed' \}/);
    // D-2: the confirm is a seat action — under bot takeover it must
    // carry the controlled seat explicitly (the baseline Avalon shape),
    // never the dispatch funnel's default null.
    expect(hook).toMatch(/viewed' \}, controlledSeat\)/);
    const screen = readSource('games/fibking/room/FibRoomScreen.tsx');
    // D-1: a controlled bot's card never plays the controller's effect.
    expect(screen).toMatch(/screen\.isBotTakeoverActive \? null : screen\.equippedRevealEffect/);
  });
});

describe('role viewing protocol — client begin gate convergence (C-1)', () => {
  const beginGateConsumers = [
    'games/avalon/room/avalonRoomAdapter.ts',
    'games/demo/room/demoRoomAdapter.ts',
    'games/fibking/room/fibRoomAdapter.ts',
    'games/undercover/room/undercoverRoomAdapter.ts',
    'games/werewolf/room/createWerewolfHostManagement.ts',
  ];

  it('every viewing game routes its begin gate through the shared factory', () => {
    for (const path of beginGateConsumers) {
      expect(readSource(path)).toContain('createViewingBeginGate(');
    }
  });

  it('the generator identity template ships the same factory call', () => {
    const templatePath = join(
      SRC_ROOT,
      '..',
      'scripts/lib/new-game/templates/identity/src/games/__GAME_ID__/room/__GAME_CAMEL__RoomAdapter.ts.tmpl',
    );
    expect(readFileSync(templatePath, 'utf8')).toContain('createViewingBeginGate(');
  });

  it('no adapter keeps a hand-rolled begin predicate (B-4)', () => {
    expect(readSource('games/undercover/room/undercoverRoomAdapter.ts')).not.toContain(
      'confirmedSeats.length ===',
    );
    expect(readSource('games/fibking/room/fibRoomAdapter.ts')).not.toContain('hasEverySeatViewed');
  });
});
