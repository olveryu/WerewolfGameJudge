/**
 * useNightInteraction seat taps on the wolf step: under the kill-disabled
 * hint a tap shows the hint message and submits nothing; on a plain wolf
 * night the tap still opens the vote confirm and submits on confirm.
 */

import { type RoleId, SCHEMAS } from '@game-judge/game-engine/games/werewolf/public';
import { act, renderHook } from '@testing-library/react';

import { showConfirmAlert, showDismissAlert } from '@/utils/alertPresets';

import { nightState, viewAs } from '../../night/__tests__/nightFixtures';
import { useNightInteraction } from '../useNightInteraction';

vi.mock('@/utils/alertPresets', () => ({
  showConfirmAlert: vi.fn(),
  showDismissAlert: vi.fn(),
}));
vi.mock('sonner', () => ({ toast: { info: vi.fn() } }));

const BOARD: readonly RoleId[] = ['wolf', 'wolf', 'seer', 'witch', 'hunter', 'villager'];
const NOW = 10_000;
const HINT_MESSAGE = '今晚狼人无法袭击';
const EXPECTED_TAP_MESSAGE = `${SCHEMAS.wolfKill.ui!.prompt}\n\n⚠️ ${HINT_MESSAGE}`;

function renderWolfNight(
  options: {
    readonly hint?: boolean;
    readonly armed?: boolean;
    readonly audioPlaying?: boolean;
    readonly viewerSeat?: number;
  } = {},
) {
  const viewerSeat = options.viewerSeat ?? 0;
  const state = nightState({
    roles: BOARD,
    stepId: 'wolfKill',
    overrides: {
      ...(options.armed
        ? {
            currentNightResults: { wolfVotesBySeat: { '0': 5 } },
            nightStep: { kind: 'inStep', stepId: 'wolfKill', stepDeadline: NOW + 4_200 },
          }
        : {}),
      ...(options.hint
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
        : {}),
      ...(options.audioPlaying ? { isAudioPlaying: true } : {}),
    },
  });
  const submit = vi.fn(async (): Promise<boolean> => true);
  const rendered = renderHook(() =>
    useNightInteraction({
      state,
      viewModel: viewAs(state, viewerSeat),
      userId: `u${viewerSeat}`,
      roomId: 'room-1',
      controlledSeat: viewerSeat,
      effectiveSeat: viewerSeat,
      isAudioResumeDue: false,
      hasPendingCommand: false,
      nowMs: NOW,
      submit: submit,
    }),
  );
  // The entry prompt fires a dismiss alert on mount; drop it so each test
  // observes only the tap under test.
  vi.clearAllMocks();
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
    expect(showDismissAlert).toHaveBeenCalledWith(expect.any(String), EXPECTED_TAP_MESSAGE);
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

    const confirmCalls = vi.mocked(showConfirmAlert).mock.calls;
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

describe('useNightInteraction nightStatusLine', () => {
  it('shows the countdown line while audio playback blocks the model', () => {
    const { result } = renderWolfNight({ armed: true, audioPlaying: true });
    expect(result.current.model.kind).toBe('blocked');
    expect(result.current.actionMessage).toBeNull();
    expect(result.current.nightStatusLine).toBe('1/2 狼人已确认（5秒后确认）');
  });

  it('hides the line when the viewer has not voted', () => {
    const { result } = renderWolfNight({ armed: true, audioPlaying: true, viewerSeat: 1 });
    expect(result.current.nightStatusLine).toBeNull();
  });

  it('hides the line when audio is not playing', () => {
    const { result } = renderWolfNight({ armed: true });
    expect(result.current.nightStatusLine).toBeNull();
  });

  it('hides the line when the countdown is not armed', () => {
    const { result } = renderWolfNight({ audioPlaying: true });
    expect(result.current.nightStatusLine).toBeNull();
  });
});
