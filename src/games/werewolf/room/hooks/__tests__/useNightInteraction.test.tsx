/**
 * useNightInteraction seat taps on the wolf step: under the kill-disabled
 * hint a tap shows the hint message and submits nothing; on a plain wolf
 * night the tap still opens the vote confirm and submits on confirm.
 */

import type { RoleId } from '@game-judge/game-engine/games/werewolf/public';
import { act, renderHook } from '@testing-library/react-native';

import { showConfirmAlert, showDismissAlert } from '@/utils/alertPresets';

import { nightState, viewAs } from '../../night/__tests__/nightFixtures';
import { useNightInteraction } from '../useNightInteraction';

jest.mock('@/utils/alertPresets', () => ({
  showConfirmAlert: jest.fn(),
  showDismissAlert: jest.fn(),
}));
jest.mock('sonner-native', () => ({ toast: { info: jest.fn() } }));

const BOARD: readonly RoleId[] = ['wolf', 'wolf', 'seer', 'witch', 'hunter', 'villager'];
const NOW = 10_000;
const HINT_MESSAGE = '今晚狼人无法袭击';

function renderWolfNight(overrides?: { readonly hint?: boolean }) {
  const state = nightState({
    roles: BOARD,
    stepId: 'wolfKill',
    overrides: overrides?.hint
      ? {
          ui: {
            currentActorHint: {
              kind: 'wolf_kill_disabled',
              targetRoleIds: ['wolf'],
              message: HINT_MESSAGE,
              bottomAction: 'wolfEmptyOnly',
            },
          },
        }
      : undefined,
  });
  const submit = jest.fn(async (): Promise<boolean> => true);
  const rendered = renderHook(() =>
    useNightInteraction({
      state,
      viewModel: viewAs(state, 0),
      userId: 'u0',
      roomId: 'room-1',
      controlledSeat: 0,
      effectiveSeat: 0,
      isAudioResumeDue: false,
      hasPendingCommand: false,
      nowMs: NOW,
      submit: submit,
    }),
  );
  // The entry prompt fires a dismiss alert on mount; drop it so each test
  // observes only the tap under test.
  jest.clearAllMocks();
  return { ...rendered, submit };
}

describe('useNightInteraction wolfVote seat taps', () => {
  it('shows the hint message and submits nothing under the kill-disabled hint', () => {
    const { result, submit } = renderWolfNight({ hint: true });
    let tapped = false;
    act(() => {
      tapped = result.current.onSeatTap(3);
    });
    expect(tapped).toBe(true);
    expect(showDismissAlert).toHaveBeenCalledTimes(1);
    expect(showDismissAlert).toHaveBeenCalledWith(expect.any(String), HINT_MESSAGE);
    expect(showConfirmAlert).not.toHaveBeenCalled();
    expect(submit).not.toHaveBeenCalled();
  });

  it('opens the vote confirm and submits the seat on a plain wolf night', async () => {
    const { result, submit } = renderWolfNight();
    let tapped = false;
    act(() => {
      tapped = result.current.onSeatTap(4);
    });
    expect(tapped).toBe(true);
    expect(showDismissAlert).not.toHaveBeenCalled();
    expect(showConfirmAlert).toHaveBeenCalledTimes(1);
    expect(submit).not.toHaveBeenCalled();

    const confirmCalls = jest.mocked(showConfirmAlert).mock.calls;
    if (confirmCalls.length !== 1) throw new Error('Expected exactly one confirm alert');
    const onConfirm = confirmCalls[0]?.[2];
    if (onConfirm === undefined) throw new Error('Confirm alert has no callback');
    await act(async () => {
      await onConfirm();
    });
    expect(submit).toHaveBeenCalledTimes(1);
    expect(submit).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ input: { kind: 'target', target: 4 } }),
      expect.anything(),
    );
  });

  it('ignores a tap on a seat outside the selectable set', () => {
    const { result, submit } = renderWolfNight();
    let tapped = true;
    act(() => {
      tapped = result.current.onSeatTap(99);
    });
    expect(tapped).toBe(false);
    expect(showDismissAlert).not.toHaveBeenCalled();
    expect(showConfirmAlert).not.toHaveBeenCalled();
    expect(submit).not.toHaveBeenCalled();
  });
});
