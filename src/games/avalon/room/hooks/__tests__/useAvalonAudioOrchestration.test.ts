/**
 * AU-33: the avalon audio ack is one durable room command. The hook plays the
 * authoritative queue once, dispatches a single `avalon.audio.ack` with
 * `durable: true`, and never starts a second playback while that ack is still
 * awaiting the server decision — reconnects are the link's business, not the
 * orchestrator's. Once the committed ack empties the queue, nothing replays.
 *
 * Rejoin (werewolf baseline): a host whose first ready snapshot of a link epoch
 * already has narration in flight is marked interrupted — the queue subscription
 * stays silent and `resumeAfterRejoin` replays the pending batch, then acks.
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

function queuedState(queue: readonly AudioEffect[], phase?: AvalonState['phase']): AvalonState {
  return buildAvalonTestState({
    ...(phase === undefined ? {} : { phase }),
    pendingAudioEffects: queue,
    isAudioPlaying: true,
    audioBatchId: QUEUED_BATCH_ID,
  });
}

const FIRST_NIGHT_STEP: AvalonState['phase'] = {
  kind: 'night',
  step: 'evilReveal',
  confirmedSeats: [],
};

/**
 * `mountedMidNarration`: the link's first ready snapshot already carries the
 * queue (host rejoin). Otherwise the link starts idle and `queueNarration`
 * publishes the batch later, as a game start would.
 */
function createFakeLink(
  queue: readonly AudioEffect[],
  mountedMidNarration: AvalonState['phase'] | null = null,
) {
  const initialState =
    mountedMidNarration === null
      ? buildAvalonTestState({ audioBatchId: 0 })
      : queuedState(queue, mountedMidNarration);
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
    /** The server queues the batch (e.g. game start). */
    queueNarration: () => {
      revision += 1;
      link.publishRoom(createRoomSnapshot(queuedState(queue), revision));
    },
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
    renderHook(() => useAvalonAudioOrchestration({ session: fake.link, isHost: true, audio }));

    await act(async () => fake.queueNarration());
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
    renderHook(() => useAvalonAudioOrchestration({ session: fake.link, isHost: true, audio }));

    await act(async () => fake.queueNarration());
    await flushPlayback();
    expect(timeline).toEqual(['play:percival_reveal', 'stopBgm', `play:${NIGHT_END_AUDIO_KEY}`]);
  });

  it('host rejoin mid-step: queue stays silent; resumeAfterRejoin replays only the current step opening and acks', async () => {
    // The batch carries the game-start line and the step opening; after a rejoin
    // only the step opening is heard again (werewolf baseline), never the whole batch.
    const queue: readonly AudioEffect[] = [{ audioKey: 'night' }, { audioKey: 'evil_reveal' }];
    const fake = createFakeLink(queue, FIRST_NIGHT_STEP);
    const { result } = renderHook(() =>
      useAvalonAudioOrchestration({ session: fake.link, isHost: true, audio }),
    );

    await flushPlayback();
    expect(result.current.readWasAudioInterrupted()).toBe(true);
    expect(audio.playEffect).not.toHaveBeenCalled();
    expect(fake.dispatch).not.toHaveBeenCalled();

    await act(async () => {
      const resumed = result.current.resumeAfterRejoin();
      await flushPlayback();
      fake.commitAck();
      await resumed;
    });
    expect(result.current.readWasAudioInterrupted()).toBe(false);
    expect(audio.playEffect.mock.calls.map(([audioKey]) => audioKey)).toEqual(['evil_reveal']);
    expect(fake.dispatch).toHaveBeenCalledTimes(1);
    expect(fake.dispatch).toHaveBeenCalledWith(
      { type: 'avalon.audio.ack', audioBatchId: QUEUED_BATCH_ID },
      { controlledSeat: null, label: '播报确认', durable: true },
    );
  });

  it('host rejoin during the dawn batch replays nothing and acks (the gate closes on the ack)', async () => {
    const fake = createFakeLink(
      [{ audioKey: 'percival_reveal', isEndAudio: true }, { audioKey: NIGHT_END_AUDIO_KEY }],
      { kind: 'nominate', round: 1, requiredSize: 2, preselectedSeats: [] },
    );
    const { result } = renderHook(() =>
      useAvalonAudioOrchestration({ session: fake.link, isHost: true, audio }),
    );
    await flushPlayback();
    expect(result.current.readWasAudioInterrupted()).toBe(true);
    await act(async () => {
      const resumed = result.current.resumeAfterRejoin();
      await flushPlayback();
      fake.commitAck();
      await resumed;
    });
    expect(audio.playEffect).not.toHaveBeenCalled();
    expect(fake.dispatch).toHaveBeenCalledTimes(1);
  });

  it('a non-host mounting mid-narration is never marked interrupted', async () => {
    const fake = createFakeLink([{ audioKey: 'night' }], FIRST_NIGHT_STEP);
    const { result } = renderHook(() =>
      useAvalonAudioOrchestration({ session: fake.link, isHost: false, audio }),
    );
    await flushPlayback();
    expect(result.current.readWasAudioInterrupted()).toBe(false);
    expect(audio.playEffect).not.toHaveBeenCalled();
  });
});
