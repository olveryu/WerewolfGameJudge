/**
 * Werewolf's ports on the platform audio orchestration (the lifecycle itself
 * is covered by `useAvalonAudioOrchestration.test.ts` / the core tests):
 * - a host mounting mid-night is marked interrupted; a non-host never is;
 * - resume replays the current step's beginning clip (seer label variant from
 *   state) and acks the interrupted batch by id; at night end it only acks;
 * - the player port routes night / night-end / ending / beginning clips.
 */
import type {
  AudioEffect,
  GameState,
  WerewolfPublicCommand,
} from '@game-judge/game-engine/games/werewolf/public';
import { GameStatus } from '@game-judge/game-engine/games/werewolf/public';
import { NIGHT_END_AUDIO_KEY } from '@game-judge/game-engine/platform/audio';
import { createRoomSnapshot } from '@game-judge/game-engine/platform/protocol/roomSnapshot';
import { act, renderHook } from '@testing-library/react-native';

import type { WerewolfAudioRuntime } from '@/games/werewolf/audio/WerewolfAudioPlayer';
import type { DispatchOutcome } from '@/platform/realtime/types';
import { createFakeRoomLink, readyLinkSnapshot, testIdentity } from '@/test-utils/linkSnapshot';
import { successfulRoomCommand } from '@/test-utils/roomCommand';
import { buildWerewolfTestState } from '@/test-utils/werewolfState';

import { useWerewolfAudioOrchestration } from '../useWerewolfAudioOrchestration';

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

function createLink(initial: GameState, userId = 'host-1') {
  let settleAck: ((outcome: DispatchOutcome<GameState>) => void) | null = null;
  const link = createFakeRoomLink<GameState, WerewolfPublicCommand>(
    readyLinkSnapshot(
      testIdentity('werewolf', { hostUserId: 'host-1', userId }),
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
    playBeginning: jest.fn(async (key: string) => {
      timeline.push(`beginning:${key}`);
    }),
    playEnding: jest.fn(async (key: string) => {
      timeline.push(`ending:${key}`);
    }),
    playNight: jest.fn(async () => {
      timeline.push('night');
    }),
    playNightEnd: jest.fn(async () => {
      timeline.push('nightEnd');
    }),
    preloadRoles: jest.fn(async () => undefined),
    stopNarration: jest.fn(),
    stopBgm: jest.fn(),
    clearPreloaded: jest.fn(),
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
    const fake = createLink(nightState({ seerLabelMap: { seer: 2 } }));
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
    expect(audio.timeline).toEqual(['beginning:seer_2']);
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

  it('routes every clip kind through the runtime and stops BGM before night end', async () => {
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
    };
    await act(async () => fake.link.publishRoom(createRoomSnapshot(queued, 2)));
    await flush();
    expect(audio.timeline).toEqual(['night', 'beginning:wolf', 'ending:wolf', 'nightEnd']);
    expect(jest.mocked(audio.stopBgm)).toHaveBeenCalledTimes(1);
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
});
