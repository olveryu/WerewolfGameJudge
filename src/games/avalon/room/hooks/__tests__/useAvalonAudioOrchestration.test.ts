/**
 * AU-33: the avalon audio ack is one durable room command. The hook plays the
 * authoritative queue once, dispatches a single `avalon.audio.ack` with
 * `durable: true`, and never starts a second playback while that ack is still
 * awaiting the server decision — reconnects are the link's business, not the
 * orchestrator's. Once the committed ack empties the queue, nothing replays.
 */
import type {
  AudioEffect,
  AvalonPublicCommand,
  AvalonState,
} from '@game-judge/game-engine/games/avalon/public';
import { NIGHT_END_AUDIO_KEY } from '@game-judge/game-engine/platform/audio';
import { createRoomSnapshot } from '@game-judge/game-engine/platform/protocol/roomSnapshot';
import { act, renderHook } from '@testing-library/react-native';

import type { DispatchOutcome } from '@/platform/realtime/types';
import { buildAvalonTestState } from '@/test-utils/avalonState';
import { createFakeRoomLink, readyLinkSnapshot, testIdentity } from '@/test-utils/linkSnapshot';
import { successfulRoomCommand } from '@/test-utils/roomCommand';

import { useAvalonAudioOrchestration } from '../useAvalonAudioOrchestration';

const QUEUED_BATCH_ID = 1;

function createFakeLink(queue: readonly AudioEffect[]) {
  const initialState = buildAvalonTestState({
    pendingAudioEffects: queue,
    isAudioPlaying: true,
    audioBatchId: QUEUED_BATCH_ID,
  });
  let revision = 1;
  let settleAck: ((outcome: DispatchOutcome<AvalonState>) => void) | null = null;
  const link = createFakeRoomLink<AvalonState, AvalonPublicCommand>(
    readyLinkSnapshot(testIdentity('avalon'), createRoomSnapshot(initialState, revision)),
    () =>
      new Promise((resolve) => {
        settleAck = resolve;
      }),
  );
  const dispatch = link.dispatch;
  return {
    link,
    dispatch,
    /** Server commits the ack: the queue empties in the authoritative state, then the promise settles. */
    commitAck: () => {
      const resolve = settleAck;
      if (resolve === null) throw new Error('no ack in flight');
      settleAck = null;
      revision += 1;
      const emptied = buildAvalonTestState({
        pendingAudioEffects: [],
        isAudioPlaying: false,
        audioBatchId: QUEUED_BATCH_ID,
      });
      link.publishRoom(createRoomSnapshot(emptied, revision));
      resolve(successfulRoomCommand(emptied, 'ack-1', revision));
    },
    /** Reconnect: the link republishes the same authoritative room after a socket swap. */
    republish: () => {
      const current = link.getSnapshot();
      if (current.phase !== 'ready') throw new Error('expected a ready link');
      link.publish({ ...current, status: { kind: 'syncing' } });
      link.publish({ ...current, status: { kind: 'live' } });
    },
  };
}

const audio = {
  preload: jest.fn(async () => undefined),
  playEffect: jest.fn<Promise<void>, [audioKey: string, isEndAudio?: boolean]>(
    async () => undefined,
  ),
  stopNarration: jest.fn(),
  stopBgm: jest.fn<void, []>(),
};

async function flushPlayback(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe('useAvalonAudioOrchestration ack reliability (AU-33)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('plays the queue once and holds a single durable ack across reconnect', async () => {
    const fake = createFakeLink([{ audioKey: 'night' }, { audioKey: 'evil_reveal' }]);
    renderHook(() =>
      useAvalonAudioOrchestration({
        session: fake.link,
        isHost: true,
        pendingAudioEffects: [{ audioKey: 'night' }, { audioKey: 'evil_reveal' }],
        audio,
      }),
    );

    await flushPlayback();
    expect(audio.playEffect).toHaveBeenCalledTimes(2);
    expect(fake.dispatch).toHaveBeenCalledTimes(1);
    expect(fake.dispatch).toHaveBeenCalledWith(
      { type: 'avalon.audio.ack', audioBatchId: QUEUED_BATCH_ID },
      { controlledSeat: null, label: '播报确认', durable: true },
    );

    // Reconnect while the durable ack is pending: the link replays the command;
    // the orchestrator must not start the queue again or dispatch a second ack.
    await act(async () => fake.republish());
    await flushPlayback();
    expect(audio.playEffect).toHaveBeenCalledTimes(2);
    expect(fake.dispatch).toHaveBeenCalledTimes(1);

    // Server decision arrives with an emptied queue: nothing more to play or ack.
    await act(async () => fake.commitAck());
    await flushPlayback();
    await act(async () => fake.republish());
    await flushPlayback();
    expect(audio.playEffect).toHaveBeenCalledTimes(2);
    expect(fake.dispatch).toHaveBeenCalledTimes(1);
  });

  it('forwards the shared dawn timing: BGM stops right before night_end and for no other key', async () => {
    const fake = createFakeLink([
      { audioKey: 'percival_reveal', isEndAudio: true },
      { audioKey: NIGHT_END_AUDIO_KEY },
    ]);
    const timeline: string[] = [];
    audio.playEffect.mockImplementation(async (audioKey: string) => {
      timeline.push(`play:${audioKey}`);
    });
    audio.stopBgm.mockImplementation(() => {
      timeline.push('stopBgm');
    });
    renderHook(() =>
      useAvalonAudioOrchestration({
        session: fake.link,
        isHost: true,
        pendingAudioEffects: [],
        audio,
      }),
    );

    await flushPlayback();
    expect(timeline).toEqual(['play:percival_reveal', 'stopBgm', `play:${NIGHT_END_AUDIO_KEY}`]);
  });
});
