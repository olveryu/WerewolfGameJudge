/**
 * Seat Picking — client contract.
 *
 * Mode-based seat-board picking is a single shared mechanism:
 * resolveSeatPickTap (pure tap resolution) + useSeatPicking (activation,
 * anchoring, storage). These assertions pin the boundary: every picking
 * consumer routes its taps through the mechanism, and the per-game
 * picking state shapes that the mechanism replaced must not come back.
 * Eligibility sets stay with each game's policy — that is content the
 * contract deliberately does not pin.
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const SRC_ROOT = join(__dirname, '..', '..', '..');

function readSource(relativePath: string): string {
  const fullPath = join(SRC_ROOT, relativePath);
  if (!existsSync(fullPath)) throw new Error(`Expected source file to exist: ${relativePath}`);
  return readFileSync(fullPath, 'utf8');
}

describe('seat picking — shared mechanism boundary', () => {
  it('the pure resolution exists once and the hook builds on it', () => {
    const model = readSource('features/room/model/seatPicking.ts');
    expect(model).toMatch(/export function resolveSeatPickTap/);
    const hook = readSource('features/room/hooks/useSeatPicking.ts');
    expect(hook).toMatch(/export function useSeatPicking/);
    expect(hook).toMatch(/resolveSeatPickTap\(/);
  });

  it('the hook is game-agnostic (no per-game imports)', () => {
    const hook = readSource('features/room/hooks/useSeatPicking.ts');
    expect(hook).not.toMatch(/from '@\/games\//);
    expect(hook).not.toMatch(/from '@game-judge\/game-engine\/games\//);
    const model = readSource('features/room/model/seatPicking.ts');
    expect(model).not.toMatch(/from '@\/games\//);
    expect(model).not.toMatch(/from '@game-judge\/game-engine\/games\//);
  });
});

describe('seat picking — avalon consumers', () => {
  it('all four picking points in the room screen go through useSeatPicking', () => {
    const screen = readSource('games/avalon/room/AvalonRoomScreen.tsx');
    expect(screen.match(/useSeatPicking\(\{/g)).toHaveLength(4);
    // The leader-local picking state must not come back: the nomination
    // draft lives on the server and reaches the screen via the view model.
    expect(screen).not.toMatch(/nominateSelection/);
    expect(screen).not.toMatch(/pickedSeats/);
  });

  it('the room state and adapter carry no picked-seats plumbing', () => {
    const state = readSource('games/avalon/room/hooks/useAvalonRoomState.ts');
    expect(state).not.toMatch(/pickedSeats/);
    const adapter = readSource('games/avalon/room/avalonRoomAdapter.ts');
    expect(adapter).not.toMatch(/pickedSeats/);
  });
});

describe('seat picking — undercover consumer', () => {
  it('round controls pick through useSeatPicking in replace mode', () => {
    const controls = readSource('games/undercover/room/hooks/useUndercoverRoundControls.ts');
    expect(controls).toMatch(/useSeatPicking\(\{/);
    expect(controls).toMatch(/mode: 'replace'/);
    // The hand-rolled composite selection state must not come back.
    expect(controls).not.toMatch(/seat: number \| null \} \| null/);
    expect(controls).not.toMatch(/setSelection\(\{/);
  });
});

describe('seat picking — fibking consumer', () => {
  it('the guessing branch picks through useSeatPicking in trigger mode', () => {
    const screenState = readSource('games/fibking/room/hooks/useFibRoomScreenState.ts');
    expect(screenState).toMatch(/useSeatPicking\(\{/);
    expect(screenState).toMatch(/mode: 'trigger'/);
    expect(screenState).toMatch(/guessTap\(seat\)/);
  });
});
