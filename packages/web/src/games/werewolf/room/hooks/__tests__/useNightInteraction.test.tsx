/**
 * useNightInteraction seat taps on the wolf step: under the kill-disabled
 * hint a tap shows the hint message and submits nothing; on a plain wolf
 * night only the explicit selection mode can draft and submit a vote.
 */

import { type RoleId, SCHEMAS } from '@game-judge/game-engine/games/werewolf/public';
import { act, renderHook } from '@testing-library/react';
import { toast } from 'sonner';

import { dismissAlert } from '@/utils/alert';
import { showConfirmAlert, showDismissAlert } from '@/utils/alertPresets';

import { nightState, viewAs } from '../../night/__tests__/nightFixtures';
import { useNightInteraction } from '../useNightInteraction';

vi.mock('@/utils/alertPresets', () => ({
  showConfirmAlert: vi.fn(
    (
      _title: string,
      _message: string,
      _onConfirm: () => void | Promise<void>,
      options?: { onShown?: (generation: number | null) => void },
    ) => options?.onShown?.(42),
  ),
  showDismissAlert: vi.fn(
    (
      _title: string,
      _message: string,
      _onDismiss?: () => void | Promise<void>,
      onShown?: (generation: number | null) => void,
    ) => onShown?.(43),
  ),
}));
vi.mock('@/utils/alert', () => ({ dismissAlert: vi.fn() }));
vi.mock('sonner', () => ({ toast: { info: vi.fn(), error: vi.fn() } }));

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
      isReadingRoomInformation: false,
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

  it('only submits an armed draft after the confirmation dialog is accepted', async () => {
    const { result, submit } = renderWolfNight();
    act(() => {
      result.current.onSeatTap(4);
    });
    expect(result.current.seatSelection).toBeNull();
    act(() => result.current.onNightButton({ kind: 'startSeatSelection' }));
    act(() => {
      result.current.onSeatTap(4);
    });
    expect(result.current.seatSelection?.confirm?.label).toBe('确认袭击 5号');
    expect(submit).not.toHaveBeenCalled();
    act(() => result.current.onNightButton({ kind: 'cancelSeatSelection' }));
    expect(result.current.seatSelection).toBeNull();
    act(() => result.current.onNightButton({ kind: 'startSeatSelection' }));
    expect(result.current.seatSelection?.confirm).toBeNull();
    act(() => {
      result.current.onSeatTap(4);
    });
    expect(submit).not.toHaveBeenCalled();
    const confirmationCall = vi.mocked(showConfirmAlert).mock.calls.at(-1);
    expect(confirmationCall?.[0]).toBe('狼人投票');
    expect(confirmationCall?.[1]).toContain('5号');
    expect(typeof confirmationCall?.[2]).toBe('function');
    expect(typeof confirmationCall?.[3]?.onShown).toBe('function');
    const confirm = confirmationCall?.[2];
    if (confirm === undefined) throw new Error('Missing confirmation callback');
    await act(async () => confirm());
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

  it('does not submit a confirmation after the selection has changed', async () => {
    const { result, submit } = renderWolfNight();
    act(() => result.current.onNightButton({ kind: 'startSeatSelection' }));
    act(() => {
      result.current.onSeatTap(4);
    });
    const confirm = vi.mocked(showConfirmAlert).mock.calls.at(-1)?.[2];
    if (confirm === undefined) throw new Error('Missing confirmation callback');
    act(() => {
      result.current.onSeatTap(5);
    });
    await act(async () => confirm());
    expect(submit).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('当前行动或目标已变化，请重新选择。');
  });

  it('dismisses a seat confirmation when selection mode is cancelled', () => {
    const { result } = renderWolfNight();
    act(() => result.current.onNightButton({ kind: 'startSeatSelection' }));
    act(() => {
      result.current.onSeatTap(4);
    });

    act(() => result.current.onNightButton({ kind: 'cancelSeatSelection' }));

    expect(dismissAlert).toHaveBeenCalledWith(42);
  });
});

describe('private status disclosure', () => {
  it.each([
    {
      state: nightState({
        roles: ['wolf', 'wolf', 'seer', 'cupid', 'hunter', 'villager'],
        stepId: 'cupidLoversReveal',
        overrides: { loverSeats: [0, 5] },
      }),
      viewerSeat: 0,
      action: { kind: 'openGroupReveal' } as const,
      command: 'werewolf.groupConfirm.ack',
    },
  ])(
    'asks before disclosure and submits only after acknowledgement',
    async ({ state, viewerSeat, action, command }) => {
      const submit = vi.fn(async (): Promise<boolean> => true);
      const { result } = renderHook(() =>
        useNightInteraction({
          state,
          viewModel: viewAs(state, viewerSeat),
          userId: `u${viewerSeat}`,
          roomId: 'room-1',
          controlledSeat: viewerSeat,
          effectiveSeat: viewerSeat,
          isAudioResumeDue: false,
          isReadingRoomInformation: false,
          hasPendingCommand: false,
          nowMs: NOW,
          submit,
        }),
      );
      vi.clearAllMocks();
      act(() => result.current.onNightButton(action));
      expect(showDismissAlert).not.toHaveBeenCalled();
      expect(submit).not.toHaveBeenCalled();
      const confirmationCall = vi.mocked(showConfirmAlert).mock.calls.at(-1);
      expect(confirmationCall?.[0]).toBe('查看状态？');
      expect(typeof confirmationCall?.[1]).toBe('string');
      expect(typeof confirmationCall?.[2]).toBe('function');
      expect(confirmationCall?.[3]).toMatchObject({ confirmText: '查看' });
      expect(typeof confirmationCall?.[3]?.onShown).toBe('function');
      const view = confirmationCall?.[2];
      if (view === undefined) throw new Error('Missing view callback');
      await act(async () => view());
      expect(showDismissAlert).toHaveBeenCalledTimes(1);
      expect(submit).not.toHaveBeenCalled();
      const acknowledge = vi.mocked(showDismissAlert).mock.calls.at(-1)?.[2];
      if (acknowledge === undefined) throw new Error('Missing acknowledgement callback');
      await act(async () => acknowledge());
      expect(submit).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ type: command }),
        expect.anything(),
      );
    },
  );
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

  it('does not disclose a status after the night step changes', async () => {
    const state = nightState({
      roles: ['wolf', 'wolf', 'seer', 'cupid', 'hunter', 'villager'],
      stepId: 'cupidLoversReveal',
      overrides: { loverSeats: [0, 5] },
    });
    const nextState = nightState({
      roles: ['wolf', 'wolf', 'seer', 'cupid', 'hunter', 'villager'],
      stepId: 'wolfKill',
    });
    const submit = vi.fn(async (): Promise<boolean> => true);
    const { result, rerender } = renderHook(
      ({ currentState }) =>
        useNightInteraction({
          state: currentState,
          viewModel: viewAs(currentState, 0),
          userId: 'u0',
          roomId: 'room-1',
          controlledSeat: 0,
          effectiveSeat: 0,
          isAudioResumeDue: false,
          isReadingRoomInformation: false,
          hasPendingCommand: false,
          nowMs: NOW,
          submit,
        }),
      { initialProps: { currentState: state } },
    );
    vi.clearAllMocks();
    act(() => result.current.onNightButton({ kind: 'openGroupReveal' }));
    const view = vi.mocked(showConfirmAlert).mock.calls.at(-1)?.[2];
    if (view === undefined) throw new Error('Missing view callback');
    rerender({ currentState: nextState });
    await act(async () => view());
    expect(showDismissAlert).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('当前状态已变化，请重新查看。');
    expect(submit).not.toHaveBeenCalled();
  });
});
