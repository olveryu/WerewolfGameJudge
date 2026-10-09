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
