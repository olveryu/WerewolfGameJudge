/**
 * useWerewolfHostFlow — the host commands' durability and audio teardown:
 * - MVP selection is a one-shot per deal and goes out durable;
 * - restart stops narration and drops preloaded clips after a successful command;
 * - the MVP picker never survives a new deal.
 */
import type { GameState } from '@game-judge/game-engine/games/werewolf/public';
import { GameStatus } from '@game-judge/game-engine/games/werewolf/public';
import { act, renderHook } from '@testing-library/react';

import type { WerewolfAudioRuntime } from '@/games/werewolf/audio/WerewolfAudioPlayer';
import type { WerewolfSubmit } from '@/games/werewolf/model/WerewolfRoomSession';
import { createFakeBgm } from '@/test-utils/fakeBgm';
import { buildWerewolfTestState } from '@/test-utils/werewolfState';
import { showConfirmAlert, showDestructiveAlert } from '@/utils/alertPresets';

import { useWerewolfHostFlow } from '../useWerewolfHostFlow';

vi.mock('@/utils/alertPresets', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/utils/alertPresets')>()),
  showConfirmAlert: vi.fn(),
  showDestructiveAlert: vi.fn(),
}));

function createAudio(): WerewolfAudioRuntime {
  return {
    playEffect: vi.fn(async () => undefined),
    preload: vi.fn(),
    stopNarration: vi.fn(),
    ...createFakeBgm(),
    setBgmVolume: vi.fn(),
    setGameAudioVolume: vi.fn(),
    clearPreloaded: vi.fn(),
  };
}

function endedState(overrides: Partial<GameState> = {}): GameState {
  return buildWerewolfTestState({
    status: GameStatus.Ended,
    roleRevealRandomNonce: 'nonce-1',
    startingParticipants: [{ userId: 'u1', seat: 0 }],
    roster: { 0: { seat: 0, userId: 'u1', profile: { displayName: '甲' } } },
    ...overrides,
  });
}

function renderFlow(state: GameState) {
  const submit = vi.fn<WerewolfSubmit>(async () => true);
  const audio = createAudio();
  const view = renderHook(
    (props: { state: GameState }) => useWerewolfHostFlow({ state: props.state, submit, audio }),
    { initialProps: { state } },
  );
  return { ...view, submit, audio };
}

/** The confirm button of the last confirmation call. */
function lastConfirm(): () => void | Promise<void> {
  const confirm = vi.mocked(showConfirmAlert).mock.calls.at(-1);
  if (confirm !== undefined) return confirm[2];
  const alert = vi.mocked(showDestructiveAlert).mock.calls.at(-1);
  if (alert === undefined) throw new Error('[TEST] no confirm button');
  return alert[3];
}

describe('useWerewolfHostFlow', () => {
  beforeEach(() => vi.clearAllMocks());

  it('submits game start without preparing audio in the host command', async () => {
    const { result, submit, audio } = renderFlow(
      buildWerewolfTestState({ status: GameStatus.Assigned }),
    );
    act(() => result.current.onHostControl('startGame'));
    await act(async () => lastConfirm()());
    expect(submit).toHaveBeenCalledWith(
      '开始游戏',
      { type: 'werewolf.game.begin' },
      {
        actionKey: 'start-game',
      },
    );
    expect(audio.preload).not.toHaveBeenCalled();
  });

  it('submits the MVP pick durable, pinned to the deal nonce, and closes the picker on success', async () => {
    const { result, submit } = renderFlow(endedState());
    act(() => result.current.openMvpSelection());
    const selection = result.current.mvpSelection;
    if (selection === null) throw new Error('[TEST] picker should be open');
    await act(async () => selection.onSelect('u1'));
    expect(submit).toHaveBeenCalledWith(
      '评选 MVP',
      {
        type: 'werewolf.mvp.select',
        selection: { roleRevealRandomNonce: 'nonce-1', mvpUserId: 'u1' },
      },
      { durable: true, actionKey: 'select-mvp' },
    );
    expect(result.current.mvpSelection).toBeNull();
  });

  it('a new deal closes the picker', () => {
    const { result, rerender } = renderFlow(endedState());
    act(() => result.current.openMvpSelection());
    expect(result.current.mvpSelection).not.toBeNull();
    rerender({ state: endedState({ roleRevealRandomNonce: 'nonce-2' }) });
    expect(result.current.mvpSelection).toBeNull();
  });

  it.each([GameStatus.Ongoing, GameStatus.Ended])(
    'restarts %s only after confirmation and stops audio after success',
    async (status) => {
      const { result, submit, audio } = renderFlow(endedState({ status, gameSequence: 3 }));
      act(() => result.current.onHostControl('restart'));
      expect(submit).not.toHaveBeenCalled();
      await act(async () => lastConfirm()());
      expect(audio.stopNarration).toHaveBeenCalledTimes(1);
      expect(audio.clearPreloaded).toHaveBeenCalledTimes(1);
      expect(submit).toHaveBeenCalledWith(
        '重新开始',
        {
          type: 'werewolf.game.restart',
          gameSequence: 3,
          wasEnded: status === GameStatus.Ended,
        },
        { actionKey: 'restart' },
      );
      const stopOrder = vi.mocked(audio.stopNarration).mock.invocationCallOrder[0];
      const submitOrder = submit.mock.invocationCallOrder[0];
      if (stopOrder === undefined || submitOrder === undefined) throw new Error('[TEST] order');
      expect(stopOrder).toBeGreaterThan(submitOrder);
    },
  );

  it('does not stop audio if a stale restart is rejected', async () => {
    const { result, submit, audio } = renderFlow(endedState({ status: GameStatus.Ongoing }));
    submit.mockResolvedValue(false);
    act(() => result.current.onHostControl('restart'));
    await act(async () => lastConfirm()());
    expect(audio.stopNarration).not.toHaveBeenCalled();
    expect(audio.clearPreloaded).not.toHaveBeenCalled();
  });
});
