/**
 * Werewolf's ports on the platform audio orchestration (the lifecycle itself
 * is covered by the core orchestrator tests):
 * - a host mounting mid-night is marked interrupted; a non-host never is;
 * - resume replays the current step's beginning clip (seer label variant from
 *   state) and acks the interrupted batch by id; at night end it only acks;
 * - the player port prepares the public board before queued or replayed narration.
 */
import type {
  AudioEffect,
  GameState,
  WerewolfPublicCommand,
} from '@game-judge/game-engine/games/werewolf/public';
import { GameStatus } from '@game-judge/game-engine/games/werewolf/public';
import { NIGHT_END_AUDIO_KEY } from '@game-judge/game-engine/platform/audio';
import { createRoomSnapshot } from '@game-judge/game-engine/platform/protocol/roomSnapshot';
import { act, renderHook } from '@testing-library/react';

import type { WerewolfAudioRuntime } from '@/games/werewolf/audio/WerewolfAudioPlayer';
import type { DispatchOutcome } from '@/platform/realtime/types';
import { createFakeBgm } from '@/test-utils/fakeBgm';
import { createFakeRoomLink, readyLinkSnapshot, testIdentity } from '@/test-utils/linkSnapshot';
import { successfulRoomCommand } from '@/test-utils/roomCommand';
import { buildWerewolfTestState } from '@/test-utils/werewolfState';
import { handleError } from '@/utils/errorPipeline';

import { useWerewolfAudioOrchestration } from '../useWerewolfAudioOrchestration';

vi.mock('@/utils/errorPipeline', () => ({ handleError: vi.fn() }));

const BATCH_ID = 3;

function nightState(overrides: Partial<GameState>): GameState {
  return buildWerewolfTestState({
    status: GameStatus.Ongoing,
    nightStep: { kind: 'inStep', stepId: 'seerCheck' },
    pendingAudioEffects: [{ audioKey: 'wolf', isEndAudio: true }, { audioKey: 'seer' }],
    isAudioPlaying: true,
    audioBatchId: BATCH_ID,
    ...overrides,
  });
}

function createLink(initial: GameState, userId = 'host') {
  let settleAck: ((outcome: DispatchOutcome<GameState>) => void) | null = null;
  const link = createFakeRoomLink<GameState, WerewolfPublicCommand>(
    readyLinkSnapshot(
      testIdentity('werewolf', { hostUserId: 'host', userId }),
      createRoomSnapshot(initial, 1),
    ),
    () =>
      new Promise((resolve) => {
        settleAck = resolve;
      }),
  );
  return {
    link,
    commitAck: () => {
      const resolve = settleAck;
      if (resolve === null) throw new Error('no ack in flight');
      settleAck = null;
      const acked = { ...initial, pendingAudioEffects: [], isAudioPlaying: false };
      link.publishRoom(createRoomSnapshot(acked, 2));
      resolve(successfulRoomCommand(acked, 'ack', 2));
    },
  };
}

function createAudio(): WerewolfAudioRuntime & { readonly timeline: string[] } {
  const timeline: string[] = [];
  return {
    timeline,
    playEffect: vi.fn(async (key: string) => {
      timeline.push(`play:${key}`);
    }),
    preload: vi.fn(() => {
      timeline.push('preload');
    }),
    stopNarration: vi.fn(),
    ...createFakeBgm(),
    setBgmVolume: vi.fn(),
    setGameAudioVolume: vi.fn(),
    clearPreloaded: vi.fn(),
  };
}

const flush = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

describe('useWerewolfAudioOrchestration (werewolf ports)', () => {
  it('marks a host mounting mid-night as interrupted and stays silent until resume', async () => {
    const audio = createAudio();
    const { link } = createLink(nightState({}));
    const { result } = renderHook(() =>
      useWerewolfAudioOrchestration({ session: link, isHost: true, audio }),
    );
    await flush();
    expect(result.current.readWasAudioInterrupted()).toBe(true);
    expect(audio.timeline).toEqual([]);
    expect(link.dispatch).not.toHaveBeenCalled();
  });

  it('never marks a non-host as interrupted', async () => {
    const audio = createAudio();
    const { link } = createLink(nightState({}), 'player-2');
    const { result } = renderHook(() =>
      useWerewolfAudioOrchestration({ session: link, isHost: false, audio }),
    );
    await flush();
    expect(result.current.readWasAudioInterrupted()).toBe(false);
    expect(audio.preload).not.toHaveBeenCalled();
    expect(audio.playEffect).not.toHaveBeenCalled();
  });

  it('does not mark a host mounting in the lobby', async () => {
    const audio = createAudio();
    const { link } = createLink(buildWerewolfTestState({ status: GameStatus.Seated }));
    const { result } = renderHook(() =>
      useWerewolfAudioOrchestration({ session: link, isHost: true, audio }),
    );
    await flush();
    expect(result.current.readWasAudioInterrupted()).toBe(false);
  });

  it('resume replays the current step beginning (seer label variant) and acks the batch by id', async () => {
    const audio = createAudio();
    const state = nightState({ seerLabelMap: { seer: 2 } });
    const fake = createLink(state);
    const { result } = renderHook(() =>
      useWerewolfAudioOrchestration({ session: fake.link, isHost: true, audio }),
    );
    await flush();
    await act(async () => {
      const resumed = result.current.resumeAfterRejoin();
      await flush();
      fake.commitAck();
      await resumed;
    });
    expect(audio.timeline).toEqual(['preload', 'play:seer_2']);
    expect(audio.preload).toHaveBeenCalledWith(state.templateRoles);
    expect(fake.link.dispatch).toHaveBeenCalledTimes(1);
    expect(fake.link.dispatch).toHaveBeenCalledWith(
      { type: 'werewolf.audio.ack', audioBatchId: BATCH_ID },
      { controlledSeat: null, label: '播报确认', durable: true },
    );
    expect(result.current.readWasAudioInterrupted()).toBe(false);
  });

  it('resume at night end replays nothing and only acks', async () => {
    const audio = createAudio();
    const fake = createLink(
      nightState({
        nightStep: { kind: 'exhausted' },
        pendingAudioEffects: [
          { audioKey: 'seer', isEndAudio: true },
          { audioKey: NIGHT_END_AUDIO_KEY },
        ],
      }),
    );
    const { result } = renderHook(() =>
      useWerewolfAudioOrchestration({ session: fake.link, isHost: true, audio }),
    );
    await flush();
    await act(async () => {
      const resumed = result.current.resumeAfterRejoin();
      await flush();
      fake.commitAck();
      await resumed;
    });
    expect(audio.timeline).toEqual([]);
    expect(fake.link.dispatch).toHaveBeenCalledTimes(1);
  });

  it('prepares the latest public board before playback and stops BGM before night end', async () => {
    const audio = createAudio();
    const queue: AudioEffect[] = [
      { audioKey: 'night' },
      { audioKey: 'wolf' },
      { audioKey: 'wolf', isEndAudio: true },
      { audioKey: NIGHT_END_AUDIO_KEY },
    ];
    const idle = buildWerewolfTestState({ status: GameStatus.Assigned });
    const fake = createLink(idle);
    renderHook(() => useWerewolfAudioOrchestration({ session: fake.link, isHost: true, audio }));
    const queued: GameState = {
      ...idle,
      status: GameStatus.Ongoing,
      pendingAudioEffects: queue,
      isAudioPlaying: true,
      audioBatchId: 1,
      templateRoles: ['wolf', 'witch', 'villager'],
    };
    await act(async () => fake.link.publishRoom(createRoomSnapshot(queued, 2)));
    await flush();
    expect(audio.timeline).toEqual([
      'preload',
      'play:night',
      'play:wolf',
      'play:wolf',
      `play:${NIGHT_END_AUDIO_KEY}`,
    ]);
    expect(audio.preload).toHaveBeenCalledWith(queued.templateRoles);
    expect(vi.mocked(audio.playEffect).mock.calls).toEqual(
      queue.map((effect) => [effect.audioKey, effect.isEndAudio]),
    );
    expect(vi.mocked(audio.stopBgm)).toHaveBeenCalledTimes(1);

    await act(async () => fake.link.publishRoom(createRoomSnapshot(queued, 3)));
    await flush();
    expect(audio.preload).toHaveBeenCalledTimes(1);
    expect(audio.playEffect).toHaveBeenCalledTimes(queue.length);
  });

  it('stops narration on unmount', async () => {
    const audio = createAudio();
    const { link } = createLink(buildWerewolfTestState());
    const { unmount } = renderHook(() =>
      useWerewolfAudioOrchestration({ session: link, isHost: true, audio }),
    );
    unmount();
    expect(audio.stopNarration).toHaveBeenCalledTimes(1);
  });

  it('reports preparation failure without playing or acknowledging the batch', async () => {
    const audio = createAudio();
    const error = new Error('board audio preparation failed');
    vi.mocked(audio.preload).mockImplementation(() => {
      throw error;
    });
    const initial = buildWerewolfTestState({ status: GameStatus.Assigned });
    const { link } = createLink(initial);
    renderHook(() => useWerewolfAudioOrchestration({ session: link, isHost: true, audio }));

    await act(async () => link.publishRoom(createRoomSnapshot(nightState({}), 2)));
    await flush();

    expect(handleError).toHaveBeenCalledWith(
      error,
      expect.objectContaining({ label: '音频效果队列', feedback: false }),
    );
    expect(audio.playEffect).not.toHaveBeenCalled();
    expect(link.dispatch).not.toHaveBeenCalled();
  });
});
