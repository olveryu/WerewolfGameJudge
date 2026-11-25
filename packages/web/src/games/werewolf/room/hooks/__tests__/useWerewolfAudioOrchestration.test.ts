/**
 * Werewolf's ports on the platform audio orchestration (the lifecycle itself
 * is covered by the core orchestrator tests):
 * - a host mounting mid-night is marked interrupted; a non-host never is;
 * - recovery replays the complete authoritative batch, including role variants and closing cues;
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
import type { DispatchOutcome, LinkStatus } from '@/platform/realtime/types';
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
    setStatus: (status: LinkStatus) => {
      link.publish({ ...link.getSnapshot(), status });
    },
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
    expect(result.current.isResumeRequired).toBe(true);
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
    expect(result.current.isResumeRequired).toBe(false);
    expect(audio.preload).not.toHaveBeenCalled();
    expect(audio.playEffect).not.toHaveBeenCalled();
  });

  it.each([GameStatus.Seated, GameStatus.Day])(
    'does not require recovery in %s without pending narration',
    async (status) => {
      const audio = createAudio();
      const { link } = createLink(buildWerewolfTestState({ status }));
      const { result } = renderHook(() =>
        useWerewolfAudioOrchestration({ session: link, isHost: true, audio }),
      );
      await flush();
      expect(result.current.isResumeRequired).toBe(false);
    },
  );

  it('requires a gesture when the host re-enters a quiet night', async () => {
    const audio = createAudio();
    const { link } = createLink(buildWerewolfTestState({ status: GameStatus.Ongoing }));
    const { result } = renderHook(() =>
      useWerewolfAudioOrchestration({ session: link, isHost: true, audio }),
    );
    await flush();
    expect(result.current.isResumeRequired).toBe(true);
    expect(audio.playEffect).not.toHaveBeenCalled();
    await act(async () => result.current.resumeAfterRejoin());
    expect(result.current.isResumeRequired).toBe(false);
    expect(link.dispatch).not.toHaveBeenCalled();
  });

  it('does not prompt when a host already in the room starts a quiet night', async () => {
    const audio = createAudio();
    const { link } = createLink(buildWerewolfTestState({ status: GameStatus.Seated }));
    const { result } = renderHook(() =>
      useWerewolfAudioOrchestration({ session: link, isHost: true, audio }),
    );
    act(() => {
      link.publishRoom(
        createRoomSnapshot(buildWerewolfTestState({ status: GameStatus.Ongoing }), 2),
      );
    });
    expect(result.current.isResumeRequired).toBe(false);
  });

  it('resumes the full engine queue, preserving closing cues and the queued seer label variant', async () => {
    const audio = createAudio();
    const state = nightState({
      seerLabelMap: { seer: 2 },
      pendingAudioEffects: [{ audioKey: 'wolf', isEndAudio: true }, { audioKey: 'seer_2' }],
    });
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
    expect(audio.timeline).toEqual(['preload', 'play:wolf', 'play:seer_2']);
    expect(audio.preload).toHaveBeenCalledWith(state.templateRoles);
    expect(fake.link.dispatch).toHaveBeenCalledTimes(1);
    expect(fake.link.dispatch).toHaveBeenCalledWith(
      { type: 'werewolf.audio.ack', audioBatchId: BATCH_ID },
      { controlledSeat: null, label: '播报确认', durable: true },
    );
    expect(result.current.isResumeRequired).toBe(false);
  });

  it('plays closing and dawn narration before acknowledging even when the night step is exhausted', async () => {
    const audio = createAudio();
    const fake = createLink(
      nightState({
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
    expect(audio.timeline).toEqual(['preload', 'play:seer', `play:${NIGHT_END_AUDIO_KEY}`]);
    expect(audio.stopBgm).toHaveBeenCalledOnce();
    expect(fake.link.dispatch).toHaveBeenCalledTimes(1);
  });

  it('waits for a gesture before replaying and acknowledging pending daytime narration', async () => {
    const audio = createAudio();
    const fake = createLink(
      nightState({
        status: GameStatus.Day,
        pendingAudioEffects: [{ audioKey: 'sheriff_signup' }],
      }),
    );
    const { result } = renderHook(() =>
      useWerewolfAudioOrchestration({ session: fake.link, isHost: true, audio }),
    );
    expect(result.current.isResumeRequired).toBe(true);
    expect(audio.playEffect).not.toHaveBeenCalled();
    await act(async () => {
      void result.current.resumeAfterRejoin();
      await flush();
    });
    expect(result.current.isResumeRequired).toBe(false);
    expect(audio.timeline).toEqual(['preload', 'play:sheriff_signup']);
    expect(fake.link.dispatch).toHaveBeenCalledExactlyOnceWith(
      { type: 'werewolf.audio.ack', audioBatchId: BATCH_ID },
      { controlledSeat: null, label: '播报确认', durable: true },
    );
    await act(async () => fake.commitAck());
  });

  it('keeps same-page playback running across reconnect without adding a resume prompt', async () => {
    const audio = createAudio();
    let finishClip = (): void => {
      throw new Error('clip has not started');
    };
    vi.mocked(audio.playEffect).mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishClip = resolve;
        }),
    );
    const fake = createLink(
      buildWerewolfTestState({
        status: GameStatus.Day,
        isAudioPlaying: false,
        pendingAudioEffects: [],
      }),
    );
    const { result } = renderHook(() =>
      useWerewolfAudioOrchestration({ session: fake.link, isHost: true, audio }),
    );
    const queued = nightState({
      status: GameStatus.Day,
      pendingAudioEffects: [{ audioKey: 'sheriff_signup' }, { audioKey: 'sheriff_start' }],
    });
    await act(async () => fake.link.publishRoom(createRoomSnapshot(queued, 2)));
    expect(audio.playEffect).toHaveBeenCalledOnce();

    await act(async () =>
      fake.setStatus({
        kind: 'waiting',
        cause: 'backoff',
        attempt: 1,
        nextRetryAtMs: 1000,
      }),
    );
    expect(result.current.isResumeRequired).toBe(false);
    expect(fake.link.dispatch).not.toHaveBeenCalled();
    expect(audio.playEffect).toHaveBeenCalledOnce();
    await act(async () => fake.setStatus({ kind: 'live' }));
    expect(fake.link.getSnapshot().epoch).toBe(1);
    expect(fake.link.getSnapshot().room?.revision).toBe(2);
    expect(result.current.isResumeRequired).toBe(false);
    expect(fake.link.dispatch).not.toHaveBeenCalled();
    expect(audio.stopNarration).not.toHaveBeenCalled();

    await act(async () => {
      finishClip();
      await flush();
      fake.commitAck();
    });
    expect(vi.mocked(audio.playEffect).mock.calls.map(([key]) => key)).toEqual([
      'sheriff_signup',
      'sheriff_start',
    ]);
    expect(fake.link.dispatch).toHaveBeenCalledOnce();
    expect(result.current.isResumeRequired).toBe(false);
  });

  it('does not replay or duplicate a durable ack already pending across reconnects', async () => {
    const audio = createAudio();
    const fake = createLink(
      nightState({
        status: GameStatus.Day,
        pendingAudioEffects: [{ audioKey: 'sheriff_signup' }],
      }),
    );
    const { result } = renderHook(() =>
      useWerewolfAudioOrchestration({ session: fake.link, isHost: true, audio }),
    );
    let resumed: Promise<void>;
    await act(async () => {
      resumed = result.current.resumeAfterRejoin();
      await flush();
    });
    await act(async () => {
      fake.setStatus({ kind: 'waiting', cause: 'offline', attempt: 1, nextRetryAtMs: null });
      fake.setStatus({ kind: 'live' });
    });
    expect(result.current.isResumeRequired).toBe(false);
    expect(audio.playEffect).toHaveBeenCalledOnce();
    expect(fake.link.dispatch).toHaveBeenCalledOnce();
    await act(async () => {
      fake.commitAck();
      await resumed;
    });
  });

  it('does not prompt for a silent daytime phase after reconnect', async () => {
    const audio = createAudio();
    const fake = createLink(
      nightState({
        status: GameStatus.Day,
        isAudioPlaying: false,
        pendingAudioEffects: [],
      }),
    );
    const { result } = renderHook(() =>
      useWerewolfAudioOrchestration({ session: fake.link, isHost: true, audio }),
    );
    expect(result.current.isResumeRequired).toBe(false);
    await act(async () => {
      fake.setStatus({ kind: 'waiting', cause: 'offline', attempt: 1, nextRetryAtMs: null });
      fake.setStatus({ kind: 'live' });
    });
    expect(result.current.isResumeRequired).toBe(false);
    expect(audio.playEffect).not.toHaveBeenCalled();
    expect(fake.link.dispatch).not.toHaveBeenCalled();
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
      expect.objectContaining({ label: '语音播报', feedback: 'toast' }),
    );
    expect(audio.playEffect).not.toHaveBeenCalled();
    expect(link.dispatch).not.toHaveBeenCalled();
  });

  it.each(['entry', 'playback'] as const)(
    'offers recovery after an %s playback failure without a new revision',
    async (scenario) => {
      const audio = createAudio();
      const failure = new Error('autoplay blocked');
      vi.mocked(audio.playEffect).mockRejectedValueOnce(failure);
      const queued = nightState({
        status: GameStatus.Day,
        pendingAudioEffects: [{ audioKey: 'sheriff_signup' }],
      });
      const fake = createLink(scenario === 'entry' ? queued : buildWerewolfTestState());
      const { result } = renderHook(() =>
        useWerewolfAudioOrchestration({ session: fake.link, isHost: true, audio }),
      );
      if (scenario === 'entry') {
        await act(async () => result.current.resumeAfterRejoin());
      } else {
        await act(async () => fake.link.publishRoom(createRoomSnapshot(queued, 1)));
      }
      expect(fake.link.getSnapshot().room?.revision).toBe(1);
      expect(result.current.isResumeRequired).toBe(true);
      expect(fake.link.dispatch).not.toHaveBeenCalled();
      expect(handleError).toHaveBeenCalledWith(
        failure,
        expect.objectContaining({ feedback: 'toast' }),
      );
      await act(async () => {
        const resumed = result.current.resumeAfterRejoin();
        await flush();
        fake.commitAck();
        await resumed;
      });
      expect(result.current.isResumeRequired).toBe(false);
      expect(fake.link.dispatch).toHaveBeenCalledOnce();
    },
  );
});
