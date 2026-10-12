/**
 * AU-14: takeover ownership (shared bot control, lifecycle guard,
 * effective identity) lives in useWerewolfBotControl.
 */
import { act, renderHook } from '@testing-library/react-native';

import { useWerewolfBotControl } from '@/games/werewolf/hooks/useWerewolfBotControl';
import type { LocalGameState, LocalPlayer } from '@/games/werewolf/state/LocalGameState';

function makeGameState(botSeats: readonly number[] = [2]): LocalGameState {
  const players = new Map<number, LocalPlayer | null>();
  players.set(1, { userId: 'u1', seat: 1, role: 'wolf', hasViewedRole: false });
  players.set(2, {
    userId: 'u2',
    seat: 2,
    role: 'seer',
    hasViewedRole: false,
    isBot: botSeats.includes(2),
  });
  return { players } as unknown as LocalGameState;
}

function renderControl(options?: {
  readonly mySeat?: number | null;
  readonly gameState?: LocalGameState;
  readonly isHost?: boolean;
}) {
  return renderHook(
    ({ gameState, isHost }: { gameState: LocalGameState; isHost: boolean }) =>
      useWerewolfBotControl(options?.mySeat === undefined ? 1 : options.mySeat, gameState, isHost),
    {
      initialProps: {
        gameState: options?.gameState ?? makeGameState(),
        isHost: options?.isHost ?? true,
      },
    },
  );
}

describe('useWerewolfBotControl', () => {
  it('derives the effective seat and role from the active identity', () => {
    const { result } = renderControl();
    expect(result.current.effectiveSeat).toBe(1);
    expect(result.current.effectiveRole).toBe('wolf');
  });

  it('uses the controlled bot seat and role after takeover', () => {
    const { result } = renderControl();
    act(() => result.current.takeOverBot(2));
    expect(result.current.controlledSeat).toBe(2);
    expect(result.current.effectiveSeat).toBe(2);
    expect(result.current.effectiveRole).toBe('seer');
  });

  it('returns null role when the effective seat is absent', () => {
    const { result } = renderControl({ mySeat: 99 });
    expect(result.current.effectiveRole).toBeNull();
  });

  it('auto-releases when the controlled seat stops being a bot', () => {
    const { result, rerender } = renderControl();
    act(() => result.current.takeOverBot(2));
    expect(result.current.controlledSeat).toBe(2);
    rerender({ gameState: makeGameState([]), isHost: true });
    expect(result.current.controlledSeat).toBeNull();
  });

  it('auto-releases when the host loses host status', () => {
    const { result, rerender } = renderControl();
    act(() => result.current.takeOverBot(2));
    expect(result.current.controlledSeat).toBe(2);
    rerender({ gameState: makeGameState(), isHost: false });
    expect(result.current.controlledSeat).toBeNull();
  });
});
