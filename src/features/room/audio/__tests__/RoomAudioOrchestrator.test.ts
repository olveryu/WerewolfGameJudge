/**
 * RoomAudioOrchestrator — batch-id acks and ack-recheck chaining.
 *
 * Every queued batch carries an `audioBatchId`; the ack names the batch it
 * played so a replayed ack can never clear a later batch. After a successful
 * ack the core re-reads the queue source once: a strictly newer batch id is
 * chain-played (its snapshot emission was skipped by the re-entry guard and no
 * later emission is guaranteed); the same id means the broadcast has not
 * arrived yet, so the loop stops without acking that batch a second time.
 *
 * The fake source below reproduces the chaining race: the ack's dispatch swaps
 * the authoritative snapshot synchronously (the way the real session applies
 * the committed snapshot before returning the outcome) and never emits again.
 */

import { NIGHT_END_AUDIO_KEY } from '@game-judge/game-engine/platform/audio';
import type { BaseGameState } from '@game-judge/game-engine/platform/protocol/roomSnapshot';

import { successfulRoomCommand, testRoomState } from '@/test-utils/roomCommand';

import {
  RoomAudioOrchestrator,
  type RoomAudioQueueSnapshot,
  type RoomAudioQueueSource,
} from '../RoomAudioOrchestrator';

type TestEffect = { readonly audioKey: string };
type TestState = BaseGameState<'test'>;
type Snapshot = RoomAudioQueueSnapshot<TestEffect>;

const firstQueue: readonly TestEffect[] = [{ audioKey: 'night' }, { audioKey: 'evil_reveal' }];
const secondQueue: readonly TestEffect[] = [{ audioKey: 'merlin_reveal' }];

async function flushPlayback(): Promise<void> {
  for (let i = 0; i < 5; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

/** What the fake server leaves in the authoritative snapshot once an ack commits. */
type AckPlan = (ackedBatchId: number) => Snapshot;

function createHarness(onAck: AckPlan) {
  let snapshot: Snapshot | null = null;
  let listener: ((next: Snapshot | null) => void) | null = null;
  let emissionCount = 0;
  const playedKeys: string[] = [];
  const timeline: string[] = [];
  const preparedBatches: (readonly TestEffect[])[] = [];
  const ackedBatchIds: number[] = [];

  const setQueue = (effects: readonly TestEffect[], audioBatchId: number) => {
    snapshot = { pendingAudioEffects: effects, audioBatchId };
  };

  const queueSource: RoomAudioQueueSource<TestEffect> = {
    getSnapshot: () => snapshot,
    subscribe: (next) => {
      listener = next;
      return () => {
        listener = null;
      };
    },
  };

  const orchestrator = new RoomAudioOrchestrator<TestEffect, TestState>({
    queueSource,
    player: {
      playEffect: async (effect) => {
        playedKeys.push(effect.audioKey);
        timeline.push(`play:${effect.audioKey}`);
      },
      stopBgm: () => {
        timeline.push('stopBgm');
      },
      prepareQueue: async (effects) => {
        preparedBatches.push(effects);
      },
    },
    ack: {
      dispatch: async (audioBatchId) => {
        ackedBatchIds.push(audioBatchId);
        // The committed ack applies the progressed snapshot before the
        // outcome returns; the swap never emits a snapshot.
        snapshot = onAck(audioBatchId);
        return successfulRoomCommand(testRoomState('test'), `ack-${ackedBatchIds.length}`);
      },
    },
    isHost: () => true,
    isAborted: () => false,
    logger: { info: jest.fn(), warn: jest.fn() },
  });

  const emitCurrent = () => {
    emissionCount += 1;
    listener?.(snapshot);
  };

  return {
    orchestrator,
    setQueue,
    emitCurrent,
    getEmissionCount: () => emissionCount,
    playedKeys,
    timeline,
    preparedBatches,
    ackedBatchIds,
  };
}

/** Ack of batch 1 progresses the game into batch 2 (second queue); any later ack drains. */
const progressIntoSecondQueue: AckPlan = (ackedBatchId) =>
  ackedBatchId === 1
    ? { pendingAudioEffects: secondQueue, audioBatchId: 2 }
    : { pendingAudioEffects: [], audioBatchId: ackedBatchId };

/** Ack clears the batch it names and nothing follows. */
const drainAckedBatch: AckPlan = (ackedBatchId) => ({
  pendingAudioEffects: [],
  audioBatchId: ackedBatchId,
});

describe('RoomAudioOrchestrator batch-id acks', () => {
  it('acks the batch it played with that batch id', async () => {
    const harness = createHarness(drainAckedBatch);
    harness.setQueue(firstQueue, 7);

    harness.emitCurrent();
    await flushPlayback();

    expect(harness.playedKeys).toEqual(['night', 'evil_reveal']);
    expect(harness.ackedBatchIds).toEqual([7]);

    harness.orchestrator.dispose();
  });

  it('chain-plays a strictly newer batch found after the ack and acks it by its own id', async () => {
    const harness = createHarness(progressIntoSecondQueue);
    harness.setQueue(firstQueue, 1);

    // The one and only snapshot emission: it starts the first batch.
    harness.emitCurrent();
    await flushPlayback();

    // First batch played, then the recheck found batch 2 and chain-played
    // it — no second emission ever arrived.
    expect(harness.getEmissionCount()).toBe(1);
    expect(harness.playedKeys).toEqual(['night', 'evil_reveal', 'merlin_reveal']);
    expect(harness.preparedBatches).toEqual([firstQueue, secondQueue]);
    expect(harness.ackedBatchIds).toEqual([1, 2]);

    harness.orchestrator.dispose();
  });

  it('stops without a second ack when the source still holds the acked batch', async () => {
    // The ack committed server-side but the cleared broadcast has not
    // arrived: the source still shows batch 1 with its effects pending.
    const harness = createHarness(() => ({ pendingAudioEffects: firstQueue, audioBatchId: 1 }));
    harness.setQueue(firstQueue, 1);

    harness.emitCurrent();
    await flushPlayback();

    expect(harness.playedKeys).toEqual(['night', 'evil_reveal']);
    expect(harness.ackedBatchIds).toEqual([1]);

    harness.orchestrator.dispose();
  });

  it('forwards the batch id through dispatchAudioAck for game-side resume flows', async () => {
    const harness = createHarness(drainAckedBatch);

    await harness.orchestrator.dispatchAudioAck('resumeAfterRejoin', 5);

    expect(harness.ackedBatchIds).toEqual([5]);
    expect(harness.playedKeys).toEqual([]);

    harness.orchestrator.dispose();
  });
});

describe('RoomAudioOrchestrator resume after rejoin', () => {
  it('holds the re-entry guard across the replay: a snapshot republish mid-replay does not start a second playback', async () => {
    const harness = createHarness(drainAckedBatch);
    harness.setQueue(firstQueue, 3);
    harness.orchestrator.setWasAudioInterrupted(true);
    // The interrupted flag suppresses reactive playback of the persisted batch.
    harness.emitCurrent();
    await flushPlayback();
    expect(harness.playedKeys).toEqual([]);

    const replayGate = Promise.withResolvers<void>();
    const resumed = harness.orchestrator.resumeInterrupted(() => replayGate.promise, 3);
    await flushPlayback();
    expect(harness.orchestrator.wasAudioInterrupted).toBe(false);

    // Same epoch, same batch, broadcast again while the replay is still playing.
    harness.emitCurrent();
    await flushPlayback();
    expect(harness.playedKeys).toEqual([]);
    expect(harness.ackedBatchIds).toEqual([]);

    replayGate.resolve();
    await resumed;
    expect(harness.ackedBatchIds).toEqual([3]);
    expect(harness.playedKeys).toEqual([]);

    harness.orchestrator.dispose();
  });

  it('after the resume ack, chains a strictly newer batch like reactive playback', async () => {
    const harness = createHarness(progressIntoSecondQueue);
    harness.setQueue(firstQueue, 1);
    harness.orchestrator.setWasAudioInterrupted(true);

    await harness.orchestrator.resumeInterrupted(async () => undefined, 1);

    expect(harness.ackedBatchIds).toEqual([1, 2]);
    expect(harness.playedKeys).toEqual(['merlin_reveal']);

    harness.orchestrator.dispose();
  });

  it('a failed replay still acks the interrupted batch so the gate reopens', async () => {
    const harness = createHarness(drainAckedBatch);
    harness.setQueue(firstQueue, 4);
    harness.orchestrator.setWasAudioInterrupted(true);

    await harness.orchestrator.resumeInterrupted(async () => {
      throw new Error('autoplay blocked');
    }, 4);

    expect(harness.ackedBatchIds).toEqual([4]);
    harness.orchestrator.dispose();
  });

  it('is a no-op when nothing was interrupted', async () => {
    const harness = createHarness(drainAckedBatch);
    const replay = jest.fn(async () => undefined);

    await harness.orchestrator.resumeInterrupted(replay, 1);

    expect(replay).not.toHaveBeenCalled();
    expect(harness.ackedBatchIds).toEqual([]);
    harness.orchestrator.dispose();
  });
});

describe('RoomAudioOrchestrator dawn timing', () => {
  it('stops BGM immediately before the night_end effect and before no other effect', async () => {
    const harness = createHarness(progressIntoSecondQueue);
    harness.setQueue([{ audioKey: 'percival_reveal' }, { audioKey: NIGHT_END_AUDIO_KEY }], 1);

    harness.emitCurrent();
    await flushPlayback();

    // The trailing merlin_reveal is the chained second batch released by
    // the first ack; it must not trigger another BGM stop.
    expect(harness.timeline).toEqual([
      'play:percival_reveal',
      'stopBgm',
      `play:${NIGHT_END_AUDIO_KEY}`,
      'play:merlin_reveal',
    ]);

    harness.orchestrator.dispose();
  });
});
