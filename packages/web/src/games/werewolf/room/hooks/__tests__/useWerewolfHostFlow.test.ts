/**
 * useWerewolfHostFlow — the host commands' durability and audio teardown:
 * - MVP selection is a one-shot per deal and goes out durable;
 * - abort / return-to-lobby / redeal stop narration and drop preloaded clips
 *   before the command leaves;
 * - the MVP picker never survives a new deal.
 */
import type { GameState } from '@game-judge/game-engine/games/werewolf/public';
import { GameStatus } from '@game-judge/game-engine/games/werewolf/public';
import { act, renderHook } from '@testing-library/react';

import type { WerewolfAudioRuntime } from '@/games/werewolf/audio/WerewolfAudioPlayer';
import type { WerewolfSubmit } from '@/games/werewolf/model/WerewolfRoomSession';
import { createFakeBgm } from '@/test-utils/fakeBgm';
import { buildWerewolfTestState } from '@/test-utils/werewolfState';
import { showAlert } from '@/utils/alert';
import { showConfirmAlert } from '@/utils/alertPresets';

import { useWerewolfHostFlow } from '../useWerewolfHostFlow';

vi.mock('@/utils/alert', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/utils/alert')>()),
  showAlert: vi.fn(),
}));
vi.mock('@/utils/alertPresets', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/utils/alertPresets')>()),
  showConfirmAlert: vi.fn(),
}));

function createAudio(): WerewolfAudioRuntime {
  return {
    playBeginning: vi.fn(async () => undefined),
    playEnding: vi.fn(async () => undefined),
    playNight: vi.fn(async () => undefined),
    playNightEnd: vi.fn(async () => undefined),
    preloadRoles: vi.fn(),
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
  const shareReview = vi.fn(async () => undefined);
  const view = renderHook(
    (props: { state: GameState }) =>
      useWerewolfHostFlow({ state: props.state, submit, audio, shareReview }),
    { initialProps: { state } },
  );
  return { ...view, submit, audio };
}

/** The confirm button of the last showConfirmAlert / showAlert call. */
function lastConfirm(): () => void | Promise<void> {
  const confirm = vi.mocked(showConfirmAlert).mock.calls.at(-1);
  if (confirm !== undefined) return confirm[2];
  const alert = vi.mocked(showAlert).mock.calls.at(-1);
  const button = alert?.[2]?.at(-1);
  if (button?.onPress === undefined) throw new Error('[TEST] no confirm button');
  return () => button.onPress?.();
}

describe('useWerewolfHostFlow', () => {
  beforeEach(() => vi.clearAllMocks());

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
      { durable: true },
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

  it.each([
    ['abort', GameStatus.Ongoing, '中止本局', 'werewolf.game.abort'],
    ['returnToLobby', GameStatus.Ended, '返回大厅', 'werewolf.game.returnToLobby'],
    ['redeal', GameStatus.Ended, '再来一局', 'werewolf.game.redeal'],
  ] as const)(
    '%s stops narration and drops preloaded clips before the command leaves',
    async (action, status, label, type) => {
      const { result, submit, audio } = renderFlow(endedState({ status }));
      act(() => result.current.onHostControl(action));
      await act(async () => lastConfirm()());
      expect(audio.stopNarration).toHaveBeenCalledTimes(1);
      expect(audio.clearPreloaded).toHaveBeenCalledTimes(1);
      expect(submit).toHaveBeenCalledWith(label, { type });
      const stopOrder = vi.mocked(audio.stopNarration).mock.invocationCallOrder[0];
      const submitOrder = submit.mock.invocationCallOrder[0];
      if (stopOrder === undefined || submitOrder === undefined) throw new Error('[TEST] order');
      expect(stopOrder).toBeLessThan(submitOrder);
    },
  );
});
