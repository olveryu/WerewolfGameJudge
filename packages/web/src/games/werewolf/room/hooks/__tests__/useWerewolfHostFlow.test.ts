/**
 * useWerewolfHostFlow — the host commands' durability and audio teardown:
 * - MVP selection is a one-shot per deal and goes out durable;
 * - restart stops narration and drops preloaded clips after a successful command;
 * - the MVP picker never survives a new deal.
 */
import type { GameState } from '@game-judge/game-engine/games/werewolf/public';
import { GameStatus } from '@game-judge/game-engine/games/werewolf/public';
import { act, renderHook } from '@testing-library/react';

import { confirmAction } from '@/features/room/confirm';
import type { WerewolfAudioRuntime } from '@/games/werewolf/audio/WerewolfAudioPlayer';
import type { WerewolfSubmit } from '@/games/werewolf/model/WerewolfRoomSession';
import { createBoardNightState } from '@/games/werewolf/room/__tests__/harness/boardNightScenarios';
import { createFakeBgm } from '@/test-utils/fakeBgm';
import { buildWerewolfTestState } from '@/test-utils/werewolfState';

import { useWerewolfHostFlow } from '../useWerewolfHostFlow';

vi.mock('@/features/room/confirm', () => ({ confirmAction: vi.fn() }));

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

/** The confirm callback of the last confirmation, after checking its copy. */
function lastConfirm(
  expected: Omit<Parameters<typeof confirmAction>[0], 'onConfirm'>,
): () => void | Promise<void> {
  const confirm = vi.mocked(confirmAction).mock.calls.at(-1)?.[0];
  if (confirm === undefined) throw new Error('[TEST] no confirmation');
  expect(confirm).toEqual({ ...expected, onConfirm: expect.any(Function) as unknown });
  return confirm.onConfirm;
}

describe('useWerewolfHostFlow', () => {
  beforeEach(() => vi.clearAllMocks());

  it('submits game start without preparing audio in the host command', async () => {
    const { result, submit, audio } = renderFlow(
      buildWerewolfTestState({ status: GameStatus.Assigned }),
    );
    act(() => result.current.onHostControl('startGame'));
    await act(async () => lastConfirm({ label: '开始游戏？', body: '请将手机音量调到最大' })());
    expect(submit).toHaveBeenCalledWith(
      '开始游戏',
      { type: 'werewolf.game.begin' },
      {
        actionKey: 'start-game',
      },
    );
    expect(audio.preload).not.toHaveBeenCalled();
  });

  it('confirms bot acknowledgements for the current night step and game', async () => {
    const state = createBoardNightState(
      ['cupid', 'villager'],
      (candidate) => candidate.nightState?.slice.current?.stepId === 'cupidLoversReveal',
    );
    const current = state.nightState?.slice.current;
    if (current == null) throw new Error('[TEST] expected a group reveal step');
    const { result, submit } = renderFlow({ ...state, gameSequence: 4 });

    act(() => result.current.markAllBotsGroupConfirmed());
    expect(submit).not.toHaveBeenCalled();
    await act(async () =>
      lastConfirm({ label: '标记机器人已确认？', body: '将为本阶段的机器人确认信息。' })(),
    );
    expect(submit).toHaveBeenCalledWith(
      '机器人确认',
      {
        type: 'werewolf.step.ackBots',
        gameSequence: 4,
        stepId: current.stepId,
        serial: current.serial,
      },
      { actionKey: 'mark-bots-confirmed' },
    );
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
      await act(async () =>
        lastConfirm({
          label: '重新开始？',
          body:
            status === GameStatus.Ended
              ? '你尚未确认昨夜信息。重新开始将清除本局并保留座位和板子，之后可能无法查看复盘；本局已结算，奖励不会撤销。'
              : '保留座位和板子，清除本局并回到准备。本局中止，不结算完成奖励。',
          tone: 'danger',
          confirmText: '重新开始',
        })(),
      );
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
    await act(async () =>
      lastConfirm({
        label: '重新开始？',
        body: '保留座位和板子，清除本局并回到准备。本局中止，不结算完成奖励。',
        tone: 'danger',
        confirmText: '重新开始',
      })(),
    );
    expect(audio.stopNarration).not.toHaveBeenCalled();
    expect(audio.clearPreloaded).not.toHaveBeenCalled();
  });
});
